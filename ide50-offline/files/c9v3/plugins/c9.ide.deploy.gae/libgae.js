define(function(require, exports, module) {
    main.consumes = ["Plugin", "proc", "run", "proc.apigen"];
    main.provides = ["libgae"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var run = imports.run;
        var gen = imports["proc.apigen"];
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var HEROKU = options.heroku || "/usr/local/bin/heroku";
        var GIT = options.git || "git";
        var BASEPATH = options.basePath || "/";
        
        var api = gen.create({
            runtime: HEROKU,
            basepath: BASEPATH,
            errorCheck: function(data, noAuthCheck) {
                if (!noAuthCheck 
                  && data.indexOf("Enter your Heroku credentials.") > -1) {
                    var err = new Error("Authentication Required");
                    err.code = 100;
                    return err;
                }
                if (data.substr(0, 3) == " ! ") {
                    return data;
                }
            }
        })

        /***** Methods *****/

        var login = api.createMethod({
            args: ["auth:login"],
            noauth: true,
            write: [
                { match: "Email:", text: "{username}\n" },
                { match: "Password", text: "{password}\n" }
            ],
            exit: [
                { match: "Authentication successful", result: true },
                { match: "Authentication failed", result: false, kill: true }
            ]
        });

        var logout = api.createMethod({
            args: ["auth:logout"],
            exit: [
                { match: "Local credentials cleared", result: true, kill: true }
            ]
        });

        var create = api.createMethod({
            args: function(options) {
                var args = ["apps:create"];
                if (options.name)     args.push(options.name);
                if (options.region)   args.push("--region", options.region);
                if (options.stack)    args.push("--stack", options.stack);
                return args;
            },
            exit: [
                { 
                    match: /(http\:.*)\s\|\s(.*\.git)/, 
                    result: { 
                        url: "{$1}", 
                        git: "{$2}",
                        name: /https?:\/\/(.*?)\./
                    }
                }
            ]
        });

        var destroy = api.createMethod({
            args: ["apps:destroy", "-a", "{name}", "--confirm", "{name}"],
            exit: [
                { match: "done", result: true },
                { match: "Resource not found", result: true }
            ]
        });

        var rename = api.createMethod({
            args: ["apps:rename", "{name}", "--app", "{oldname}"],
            exit: [
                { 
                    match: /(http\:.*)\s\|\s(.*\.git)/, 
                    result: { 
                        url: "{$1}", 
                        git: "{$2}",
                        name: /https?:\/\/(.*?)\./
                    }
                }
            ]
        });
        
        var download = api.createMethod({
            args: ["git:clone", "{name}"],
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
        
        var addkeys = api.createMethod({
            args: ["keys:add"],
            exit: [
                { match: "Uploading SSH public key", result: true },
            ]
        });
        
        var fork = api.createMethod({
            args: function(options) {
                var args = ["fork"];
                if (options.name)     args.push(options.name);
                if (options.region)   args.push("--region", options.region);
                if (options.stack)    args.push("--stack", options.stack);
                if (options.app)      args.push("-a", options.app);
                return args;
            },
            exit: [
                { 
                    match: /Fork complete, view it at (http\:.*)/, 
                    result: { 
                        url: "{$1}", 
                        name: /https?:\/\/(.*?)\./
                    }
                }
            ]
        });

        var getAll = api.createMethod({
            args: ["apps"],
            buffer: true,
            parse: function(data) {
                var names = [];
                data
                  .replace(/\s*=== My Apps\s*/, "")
                  .split("\n").forEach(function(line) {
                    if ((line = line.trim()))
                        names.push(line);
                });
                return names;
            }
        });
        
        var lut = {
            "Git URL" : "git",
            "Region"  : "region",
            "Stack"   : "stack",
            "Web URL" : "url"
        };

        var getInfo = api.createMethod({
            args: ["apps:info", "-a", "{name}"],
            buffer: true,
            parse: function(data) {
                var info = {}, found;
                data.split("\n").forEach(function(line) {
                    var pair = line.split(":");
                    if (lut[pair[0]]) {
                        info[lut[pair.shift()]] = pair.join(":").trim();
                        found = true;
                    }
                });

                if (!found)
                    throw new Error(data);

                info.name = info.url.match(/https?:\/\/(.*?)\./)[1];
                return info;
            }
        })
        
        var tailLog = api.createMethod({
            args: function(options) {
                var args = ["logs", "-t"];
                if (options.name)    args.push(options.name);
                if (options.lines)   args.push("-n", options.lines);
                if (options.process) args.push("-p", options.stack);
                if (options.source)  args.push("-s", options.app);
                return args;
            },
            stream: true
        })
        
        var getLog = api.createMethod({
            args: function(options) {
                var args = ["logs"];
                if (options.name)    args.push(options.name);
                if (options.lines)   args.push("-n", options.lines);
                if (options.process) args.push("-p", options.stack);
                if (options.source)  args.push("-s", options.app);
                return args;
            },
            buffer: true
        })
        
        function deploy(args, callback) {
            var gotData;
            
            var name = args.process;
            var options = args.options;
            var meta = args.meta;
            
            var process = run.run({
                cmd: [GIT, "push", meta.git, 
                    (options.branch ? options.branch + ":" : "") + "master"],
                info: "Deploying " + (options.branch || "master") + " to "
                    + meta.name + "..."
            }, {
                cwd: BASEPATH,
                detach: false
            }, name, function(err, pid) {
                if (err) {
                    gotData = true;
                    return callback(err);
                }
                
                //heroku keys:add
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
            GIT: GIT,
            HEROKU: HEROKU,
            BASEPATH: BASEPATH,
            
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
            fork: fork,
            
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
            cancelDeploy: cancelDeploy
        });
        
        register(null, {
            libgae: plugin
        });
    }
});