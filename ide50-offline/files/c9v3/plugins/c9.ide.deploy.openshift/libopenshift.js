define(function(require, exports, module) {
    main.consumes = ["Plugin", "proc", "run", "proc.apigen", "fs"];
    main.provides = ["libopenshift"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var run = imports.run;
        var fs = imports.fs;
        var gen = imports["proc.apigen"];
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var GIT = options.git || "git";
        var BASEPATH = options.basePath || "/";
        var PARSEINFO = /(http:\/\/.*\/)[\s\S]*?\s*Git URL:\s*(.*?)\s*$\n\s*Initial Git URL:\s*.*?\s*$\n\s*SSH:\s*(.*?)\s*$[\s\n]*([\s\S]*)+/m;
        
        var api = gen.create({
            runtime: options.rhc || "/usr/local/bin/rhc",
            basepath: BASEPATH,
            errorCheck: function(data, noAuthCheck) {
                if (!noAuthCheck && (
                  data.indexOf("authorization token has expired") > -1 ||
                  data.indexOf("Please sign in") > -1)) {
                    var err = new Error("Authentication Required");
                    err.code = 100;
                    return err;
                }
                if (data.substr(0, 3) == " ! ") {
                    return data;
                }
            }
        })
        
        function parseAppInfo(data) {
            var m = data.match(PARSEINFO);
            var list = m[4].split(/\-\-+|\n\n/);
            var addons = {};
            
            for (var i = 0; i < list.length; i+=2) {
                var obj = addons[list[i].trim()] = {};
                list[i + 1].split("\n").forEach(function(item) {
                    var p = item.split(":");
                    var f = p[0].trim();
                    if (!f || f == "Gears") return;
                    obj[f] = (p[1] || "").trim();
                });
            }
            
            return { url: m[1], git: m[2], ssh: m[3], addons: addons };
        }

        /***** Methods *****/

        var login = api.createMethod({
            args: ["account", "-l", "{username}"],
            noauth: true,
            write: [
                { match: "Password", text: "{password}\n" }
            ],
            exit: [
                { match: "Gears Allowed", result: true },
                { match: "Username or password is not correct", result: false, kill: true }
            ]
        });

        var logout = api.createMethod({
            args: ["logout"],
            exit: [
                { match: "All local sessions removed", result: true }
            ]
        });

        var create = api.createMethod({
            args: function(options) {
                var args = ["app-create", 
                    "--from-code", "https://github.com/c9/empty.git", "--no-git"];
                    
                if (options.name)      args.push("-a", options.name);
                if (options.size )     args.push("-g", options.size);
                if (options.namespace) args.push("-n", options.name);
                if (options.scaling)   args.push("-s", options.scaling);
                if (options.type)      args.push("-t", options.type);
                if (options.repodir)   args.push("-r", options.repodir);
                if (options.jenkins)   args.push("--enable-jenkins", 
                    typeof options.jenkins == "string" ? options.jenkins : "");
                
                return args;
            },
            buffer: true,
            write: [
                { match: "(yes/no)", text: "yes\n" },
                { match: "Please enter a namespace", text: "{domain}\n" }
            ],
            parse: parseAppInfo,
            exit: [
                { match: "Fail:", result: false }
            ]
        });
        
        function destroy(options, callback) {
            _destroy(options, function(err, success) {
                if (success) {
                    fs.rmdir("/.openshift/app_" + options.name, 
                      { recursive: true }, function(err) {
                        callback(err, !err && true);
                    })
                }
                else callback(err, success);
            });
        }
        
        var _destroy = api.createMethod({
            args: ["app", "delete", "-a", "{name}", "--confirm"],
            // write : [
            //     { match: "(yes|no)", text: "yes\n" }
            // ],
            buffer: true,
            exit: [
                { match: /Deleting application [\s\S]* deleted/, result: true },
                { match: "not found for domain", result: true }
            ]
        });

        var rename = function(options, callback) {
            callback("Not Supported");
        }
        
        var start = api.createMethod({
            args: ["app", "start", "-a", "{name}"],
            exit: [
                { match: "started", result: true }
            ]
        });
        var stop = api.createMethod({
            args: ["app", "stop", "-a", "{name}"],
            exit: [
                { match: "stopped", result: true }
            ]
        });
        var restart = api.createMethod({
            args: ["app", "restart", "-a", "{name}"],
            exit: [
                { match: "restarted", result: true }
            ]
        });
        
        var download = api.createMethod({
            args: function(options) {
                var args = ["git-clone", "-a", options.name];
                if (options.path) args.push("-r", options.path);
                return args;
            },
            write: [
                { match: "(yes/no)", text: "yes\n" }
            ],
            exit: [
                { 
                    match: "Permission denied", 
                    error: true, 
                    result: {
                        code: 100,
                        message: /[\s\S]*/
                    }
                },
            ],
            defaultSuccess: true
        });
        
        // @todo
        var addkeys = api.createMethod({
            args: ["sshkey", "add", "name", "path"],
            exit: [
                { match: "Uploading SSH public key", result: true },
            ]
        });
        
        var setup = api.createMethod({
            args: function(options) {
                var args = ["setup", "-l", options.username, "-p", 
                    options.password, "--clean"];
                if (options.server) args.push("--server", options.server);
                return args;
            },
            write: [
                { match: "Generate a token now", text: "yes\n" },
                { match: "Upload now", text: "yes\n" },
                { match: "Provide a name for this key", text: "\n" }
            ],
            exit: [
                { match: "Your client tools are now configured", result: true },
            ]
        });
        
        var getAll = api.createMethod({
            args: ["apps"],
            buffer: true,
            parse: function(data) {
                var names = [];
                data.replace(/\w*\s@\s*http:\/\/([^\-]*)\-/g, function(m, name) {
                    names.push(name);
                });
                return names;
            }
        });
        
        var getInfo = api.createMethod({
            args: ["app", "show", "-a", "{name}"],
            buffer: true,
            parse: parseAppInfo
        });
        
        var getState = api.createMethod({
            args: ["app", "show", "-a", "{name}", "--state"],
            exit: [
                { match: /Cartridge .*? is (\w+)/, result: "{$1}" }
            ]
        });
        
        // show/start/stop/restart
        // var listAddOns cartridge list
        // var addOnAdd -> Via run / output - rhc add-cartridge mysql-5.1 
        // var addOnRemove
        
        var tailLog = api.createMethod({
            args: function(options) {
                var args = ["tail"];
                if (options.name)    args.push("-a", options.name);
                if (options.lines)   args.push("-o", "-n " + options.lines);
                return args;
            },
            stream: true
        })
        
        var getLog = api.createMethod({
            args: function(options) {
                var args = ["tail"];
                if (options.name)    args.push("-a", options.name);
                if (options.lines)   args.push("-o", "-n " + options.lines)
                return args;
            },
            buffer: true
        })
        
        function deploy(args, callback) {
            var path = "/.openshift/app_" + args.meta.name;
            fs.exists(path, function(exists) {
                if (exists) {
                    _deploy(args, callback);
                }
                else {
                    // Clone
                    download({ 
                        path: BASEPATH + path, 
                        name: args.meta.name
                    }, function(err, success) {
                        if (err)
                            return callback(err);
                        
                        _deploy(args, callback);
                    })
                }
            });
        }
        
        function _deploy(args, callback) {
            var gotData;
            
            var name = args.process;
            var options = args.options;
            var meta = args.meta;
            
            var process = run.run([
                // Update the local repo via git pull
                {
                    cmd: [GIT, "pull", "../..", 
                        (options.branch ? options.branch + ":" : "") + "master"],
                    info: "Deploying " + (options.branch || "master") + " to "
                        + meta.name + "..."
                },
                // Do the actually deploy via git push 
                {
                    cmd: [GIT, "push", meta.git, 
                        (options.branch ? options.branch + ":" : "") + "master"]
                }
            ], {
                cwd: BASEPATH + "/.openshift/app_" + meta.name,
                detach: false
            }, name, function(err, pid) {
                if (err) {
                    gotData = true;
                    return callback(err);
                }
                
                //openshift keys:add
            });
            
            process.on("data", function handler(data) {
                // Error detection
                if (data.indexOf(" ! ") > -1 || data.indexOf("fatal:") > -1) {
                    var err = new Error(data);
                    err.code = data.indexOf("authorization") > -1 ? 100 : 0;
                    gotData = 2;
                    process.detach(function(){});
                    return callback(err);
                }
                
                // Nothing to do
                if (data.indexOf("Everything up-to-date") > -1) {
                    return callback(null, { nothing: true });
                }
                
                // Successfully started
                if (data.indexOf("Counting objects") > -1) {
                    process.detach(function(){});
                    return callback(null, { deploying: true });
                }
                
                if (data.indexOf("Pane is dead") > -1) {
                    if (!gotData) gotData = true;
                    process.detach(function(){});
                }
            });
            process.on("stopped", function(){
                callback(null, { deployed: gotData != 2 });
            });
            
            callback(null, { process: process, name: name });
        }
        
        function cancelDeploy(options, callback) {
            for (var i = 0; i < run.processes.length; i++) {
                if (run.processes[i].name == options.name) {
                    run.processes[i].stop(callback);
                    return;
                }
            }
            
            callback("Process not found: " + options.name);
        }
        
        /***** Register and define API *****/
        
        /**
         * Draws the file tree
         * @event afterfilesave Fires after a file is saved
         * @param {Object} e
         *     node     {XMLNode} description
         *     oldpath  {String} description
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            create: create,
            
            /**
             * 
             */
            destroy: destroy,
            
            /**
             * 
             */
            download: download,
            
            /**
             * 
             */
            setup: setup,
            
            /**
             * 
             */
            getState: getState,
            
            /**
             * 
             */
            rename: rename,
            
            /**
             * 
             */
            addkeys: addkeys,
            
            /**
             * 
             */
            getLog: getLog,
            
            /**
             * 
             */
            tailLog: tailLog,
            
            /**
             * 
             */
            login: login,
            
            /**
             * 
             */
            logout: logout,
            
            /**
             * 
             */
            getAll: getAll,
            
            /**
             * 
             */
            getInfo: getInfo,
            
            /**
             * 
             */
            deploy: deploy,
            
            /**
             * 
             */
            cancelDeploy: cancelDeploy,
            
            /**
             * 
             */
            start: start,
            
            /**
             * 
             */
            stop: stop,
            
            /**
             * 
             */
            restart: restart
        });
        
        register(null, {
            libopenshift: plugin
        });
    }
});