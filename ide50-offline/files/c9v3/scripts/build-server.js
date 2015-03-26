#!/usr/bin/env node
"use strict";

var spawn = require("child_process").spawn;
var format = require("util").format;
var dirname = require("path").dirname;
var basename = require("path").basename;
var normalize = require("path").normalize;
var fs = require("fs");
var os = require("os");
var optimist = require("optimist");
var async = require("async");
var loadManifest = require("c9/manifest").load;

var DEFAULT_MODULES = ["c9", "simple-template", "architect", "amd-loader", "heapdump", "optimist"];
var DEFAULT_SETTINGS = "deploy";
var DEFAULT_BRANCH = "deploy-docker";
var DEBUG = false;
var REPO = os.tmpDir() + "/c9-build-server";

module.exports = main;

if (!module.parent)
    main(process.argv.slice(2), function(err) {
        if (err) {
            console.error(err);
            console.error("FATAL ERROR: DEPLOY ABORTED");
            if (!DEBUG)
                console.error("Hint: use build-server.js --debug to debug this issue");
            process.exit(1);
        }
    });

function main(argv, callback) {
    var options = optimist(argv)
        .usage("Usage: $0 [CONFIG_NAME] [--help]")
        .alias("s", "settings")
        .default("settings", DEFAULT_SETTINGS)
        .describe("settings", "Settings file to use")
        .default("branch", DEFAULT_BRANCH)
        .describe("branch", "Branch to build")
        .describe("hash", "git hash to build (overrides --branch)")
        .boolean("debug")
        .describe("debug", "print commands executed")
        .boolean("clean")
        .describe("clean", "rebuild even if a version already exists")
        .boolean("deploy")
        .describe("deploy", "gssh pattern to deploy to. This script will automatically append the settings name")
        .describe("exclude", "komma separated list of hostnames to exclude")
        .boolean("help")
        .describe("help", "Show command line options.");

    argv = options.argv;
    if (argv.help) {
        options.showHelp();
        return;
    }

    DEBUG = !!argv.debug;

    var configs = argv._;
    if (configs.length > 1) {
        options.showHelp();
        return;
    }
    
    var branch;
    if (argv.hash)
        branch = argv.hash;
    else
        branch = argv.branch.replace(/^(origin\/)?/, "origin/");
        
    var exclude = (argv.exclude || "").split(",");

    var config = configs[0];
    var buildConfig, manifest, VERSION, DIR, TGZ;
    var start = Date.now();
    
    async.series([
        preConditions,
        checkout.bind(null, branch),
        function(next) {
            if (!config) {
                console.log(REPO);
                return callback();
            }
                
            // initialize VERSION
            buildConfig = require(REPO + "/configs/" + config).buildConfig();
            manifest = loadManifest(REPO);
            manifest.hostname = "[%type%]-[%provider%]-[%region%]-[%index%]-[%env%]",
            VERSION = ["c9", config, argv.settings, manifest.version, manifest.revision.slice(0, 8)].join("-");
            DIR = "/tmp/" + VERSION;
            TGZ = normalize(DIR + "/../" + VERSION + ".tgz");
            
            fs.exists(TGZ, function(exists) {
                if (exists && !argv.clean) {
                    console.log("Using cached version %s.", TGZ);
                    return next();
                }
                    
                build(buildConfig, config, argv.settings, next);
            });
        },
        function(next) {
            deploy(argv.deploy, exclude, argv.settings, config, buildConfig, next);
        },
        function(next) {
            console.log();
            console.log("Successfully built/deployed %s. Took %s sec", DIR, Math.floor((Date.now()-start) / 1000));
            console.log();
            next();
        }
    ], callback);

    function build(buildConfig, config, settingsName, callback) {
        var settings;
        async.series([
            prepareWorkdir.bind(null, config, buildConfig),
            function(next) {
                settings = require(REPO + "/settings/" + argv.settings)(manifest);
                next();
            },
            function(next) {
                nodeModules(buildConfig, next);
            },
            function(next) {
                copyPlugins(settings, config, next);
            },
            function(next) {
                generateSettings(settings, settingsName, buildConfig, next);
            },
            function(next) {
                zip(config, settings, next);
            },
        ], callback);
    }

    function preConditions(callback) {
        bash([
            "if ! curl http://metadata.google.internal/computeMetadata/v1/instance/hostname -s -H 'Metadata-Flavor: Google' | grep -q gce; then",
            "  echo The buildbot can only be run from GCE VMs >&2",
            "  exit 1",
            "fi"
        ], callback);
    }

    function checkout(branch, callback) {
        bash([
            "REPO=" + REPO,
            "mkdir -p $REPO",
            "cd $REPO",
            "[ ! -d .git ] && git clone git@github.com:c9/newclient.git .",
            "git fetch origin",
            "git reset --hard",
            "git clean -fd",
            "git checkout " + branch
        ], callback);
    }
    
    function prepareWorkdir(name, buildConfig, callback) {
        bash([
            "DIR=" + DIR,
            "REPO=" + REPO,
            "rm -rf $DIR",
            "mkdir -p $DIR",
            "cd $DIR",
            "mkdir -p plugins",
            "mkdir -p node_modules",
            "mkdir -p settings",
            "mkdir -p configs",
            "cp $REPO/server.js .",
            "cp $REPO/configs/" + name + ".js " + DIR + "/configs",
            "for I in " + buildConfig.fileInclude.join(" ") + "; do",
            format("  mkdir -p $(dirname %s/$I)", DIR),
            format("  cp -a %s/$I $(dirname %s/$I)", REPO, DIR),
            "done",
            "cd $REPO",
            "if [[ -e ~/.nvm/nvm.sh ]]; then source ~/.nvm/nvm.sh; fi",
            "if [[ -e /usr/local/lib/nvm/nvm.sh ]]; then source /usr/local/lib/nvm/nvm.sh; fi",
            "nvm use 0.10",
            "npm install settings &> /dev/null"
        ], callback);
    }
    
    function nodeModules(buildConfig, callback) {
        var packageJson = require(REPO + "/package.json");
        
        var nodeModules = packageJson.dependencies;
        delete packageJson.devDependencies;
        delete packageJson.scripts;
        
        packageJson.dependencies = buildConfig.nodeModulesInclude.concat(DEFAULT_MODULES).reduce(function(deps, name) {
            if (nodeModules[name])
                deps[name] = nodeModules[name];
            else
                deps[name] = "*";
            
            return deps;
        }, {});
        
        fs.writeFile(DIR + "/package.json", JSON.stringify(packageJson, null, 2), function(err) {
            if (err) return callback(err);
            
            bash([
                "if [[ -e ~/.nvm/nvm.sh ]]; then source ~/.nvm/nvm.sh; fi",
                "if [[ -e /usr/local/lib/nvm/nvm.sh ]]; then source /usr/local/lib/nvm/nvm.sh; fi",
                "nvm use 0.10",
                "cd " + DIR,
                "for I in " + Object.keys(packageJson.dependencies).join(" ") + "; do",
                format("  [ -d %s/node_modules/$I ] && cp -a %s/node_modules/$I %s/node_modules", REPO, REPO, DIR),
                "done",
                "npm install"
            ], callback);
        });
    }
    
    function copyPlugins(settings, config, callback) {
        config = require(REPO + "/configs/" + config)(settings, optimist([]));
        
        var plugins = Object.keys(config.reduce(function(plugins, plugin) {
            var packagePath = plugin.packagePath || plugin;
            if (packagePath.indexOf("./") === 0) {
                plugins[dirname(packagePath.slice(2))] = true;
            }
            
            return plugins;
        }, {}));
        
        bash([
            "for I in " + plugins.join(" ") + "; do",
            format("  cp -a %s/plugins/$I %s/plugins", REPO, DIR),
            "done"
        ], callback);
    }
    
    function generateSettings(oldSettings, settingsName, buildConfig, callback) {
        var newSettings =
            buildConfig.settingsInclude.concat(["node", "mode", "manifest"]).reduce(function(settings, name) {
                settings[name] = oldSettings[name];
                return settings;
            }, {});
        
        newSettings.node = oldSettings.node;
        
        var contents = 
            "var hostname = require('c9/hostname');\n" +
            "var fill = require('simple-template').fill;\n" +
            "module.exports = function() {\n" +
            "  options = hostname.parse(hostname.get());\n" +
            "  options.root = __dirname + '/..';\n" +
            "  var template = " + JSON.stringify(newSettings, null, 2).replace(new RegExp(REPO, "g"), "[%root%]") + ";\n" +
            "  return JSON.parse(fill(JSON.stringify(template), options));\n" +
            "};";

        fs.writeFile(DIR + "/settings/" + settingsName + ".js", contents, callback);
    }
    
    function zip(config, settings, callback) {
        bash([
            "VERSION=" + VERSION,
            "TGZ=" + TGZ,
            "DIR=" + DIR,
            "cd $DIR/..",
            "tar cfz $TGZ $VERSION"
        ], callback);
    } 
    
    function deploy(serverPattern, exclude, settingsName, config, buildConfig, callback) {
        if (!serverPattern)
            return callback();
            
        var suffix = {
            "onlinedev": "onlinedev",
            "beta": "beta",
            "deploy": "prod",
            "devel": "devel"
        }[settingsName];
        
        if (!suffix)
            return callback(new Error("Could not compute suffix for " + settingsName));
        
        var pattern = serverPattern + "-" + suffix;
        var targetFile = "/home/ubuntu/versions/" + basename(TGZ);
        var targetDir = "/home/ubuntu/versions/" + basename(TGZ, ".tgz");
        
        var check = [];
        if (buildConfig.check) {
            check = [
                'sleep 1',
                'for (( I=1; I<20; I++)); do'
            ].concat(buildConfig.check + "&& OK=1 && break").concat([
                '  echo check failed. Retry in 2 seconds ...',
                '  sleep 2',
                'done',
                'echo check success',
                'if [ ! "$OK" ]; then',
                '  echo safe deploy check failed >&2',
                '  exit 1',
                'fi'
            ]);
        }

        // TODO prepare parallel installs of multiple services
        config="newclient";
        
        bash([
            "REPO=" + REPO,
            "VERSION=" + VERSION,
            "TGZ=" + TGZ,
            "CONFIG=" + config,
            format("SERVERS=$($REPO/scripts/gssh --no-cache --print-names '%s')", pattern),
            'if [ ! "$SERVERS" ]; then',
            '  echo No servers to deploy to found >&2',
            '  exit 1',
            'fi',
            'echo',
            'for SERVER in $SERVERS; do',
            exclude.map(function(hostname) {
                return format('[ $SERVER == "ubuntu@%s" ] && echo "Skipping $SERVER" && continue', hostname);
            }),
            '  echo deploying to $SERVER',
            format('ssh $SERVER "rm -rf %s %s; mkdir -p /home/ubuntu/versions/history"', targetDir, targetFile),
            format('scp $TGZ $SERVER:%s', targetFile),
            format("ssh $SERVER 'cd /home/ubuntu/versions && tar xfz %s && rm %s'", targetFile, targetFile),
            format("ssh $SERVER 'export CONFIG=%s; mv /home/ubuntu/$CONFIG /home/ubuntu/versions/history/$CONFIG-$(date +%FT%T); ln -s %s /home/ubuntu/$CONFIG'", config, targetDir),
            format("ssh $SERVER '~/supervisord_start_script.sh || ~/supervisord_start_script.sh || ~/supervisord_start_script.sh || ~/supervisord_start_script.sh'"),
            format("ssh $SERVER 'cd /home/ubuntu/versions; ls %s-* -t | tail --lines=+5 | xargs sudo rm -rf'", config)
        ].concat(check).concat([
            '  echo Successfully deployed $VERSION to $SERVER',
            '  echo',
            'done'
        ]), callback);
    }

    function bash(lines, callback) {
        var script = [
            "#!/bin/bash",
            DEBUG ? "set -x" : "",
            "set -e",
            'ssh() { /usr/bin/ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /home/ubuntu/.ssh/google_compute_engine "$@"; }',
            'scp() { /usr/bin/scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /home/ubuntu/.ssh/google_compute_engine "$@"; }'
        ].concat(lines).join("\n");
        
        var bash = spawn("bash", ["-l"]);
        bash.stdout.pipe(process.stdout);
        bash.stderr.pipe(process.stderr);
        
        bash.on("close", function(code) {
            callback(code);
        });
        
        bash.stdin.write(script);
        bash.stdin.end();
    }
}
