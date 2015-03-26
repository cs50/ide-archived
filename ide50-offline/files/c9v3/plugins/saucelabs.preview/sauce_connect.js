/**
 * Sauce Connect plugin for Cloud9.
 *
 * @extends Plugin
 * @singleton
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "ui", "proc", "preview.saucelabs.auth"
    ];
    main.provides = ["preview.saucelabs.connect"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var proc = imports.proc;
        var auth = imports["preview.saucelabs.auth"];
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var INSTALL_PATH = options.installPath;
        var ASSUME_CONNECTED = options.assumeConnected;
        var EAGER_CONNECT = options.eagerConnect;
        var MAX_TRIES = 4;
        var BONUS_TRIES = 2;
        
        var isActivated = false;
        var isActive = false;
        var process;
        var processOutput;
        
        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;
            
            tryStart();
            auth.on("change", function() {
                stop();
                tryStart();
            });
            
            function tryStart() {
                if (!EAGER_CONNECT)
                    return;
                // If this user is already registered as a sauce labs user
                // and signed in, then start sauce_connect immediately
                // to avoid any delays after that (per Steven Hazel)
                if (auth.isAccountAvailable()) {
                    start(function(err) {
                        if (err)
                            console.log("[sauce_connect] early initialization failed: " + err);
                    });
                }
            }
        }
        
        function start(callback) {
            if (isActive || ASSUME_CONNECTED)
                return setTimeout(callback);
            
            plugin.once("started", function(e) {
                callback(e.error);
            });
            
            if (isActivated)
                return;
            
            isActivated = true;
            var tries = 1;
            var apiURL = auth.getServerURL() + "/rest/v1";
            var account;
            auth.getAccount(function(err, result) {
                if (err) return callback(err);
                
                account = result;
                startProcess();
            });
        
            function startProcess() {
                console.log("[sauce_connect] connecting");
                proc.spawn(INSTALL_PATH + "/sc/bin/sauceconnect", {
                    args: [
                        "-u", account.username,
                        "-k", account.apikey,
                    ].concat(apiURL ? ["-x", apiURL] : [])
                }, function(err, p) {
                    if (err) return fatalError(err);
                    
                    processOutput = "";
                    var error;
                    
                    process = p;                
                    process.stdout.on("data", function(chunk) {
                        processOutput += chunk;
                        chunk.split("\n").map(parseLine);
                    });
                    process.stderr.on("data", function(chunk) {
                        processOutput += chunk;
                        chunk.split("\n").map(parseLine);
                    });
                    process.on("exit", function(code) {
                        if (!isActivated) // doesn't need to run right now
                            return;
                        isActive = false;
                        if (!error && code === 127)
                            error = "Exit code 127: sauceconnect may not be installed";
                        if (!error && code)
                            error = "Exit code " + code;
                        if (error)
                            console.log("[sauce_connect] output: " + processOutput);
                        tryRestart(error);
                    });
            
                    function parseLine(line) {
                        if (line.match(/^(?:(?!wait).)*you may start your tests|connection established/i)) {
                            isActive = true;
                            tries = -BONUS_TRIES;
                            console.log("[sauce_connect] connected");
                            emit("started", {});
                        }
                        if (line.match(/you are now offline/i)) {
                            isActive = false;
                            console.log("[sauce_connect] temporarily disconnected?");
                        }
                        if (line.match(/error:/i)) {
                            if (line.match(/scproxy exited: 0|can't lock pidfile|can't create pidfile/i)) {
                                // This should only happen with standalone
                                line = "scproxy exited; a sauceconnect process may already be running";
                                proc.execFile("killall", {
                                    args: ["sauceconnect"]
                                }, function(err) {});
                            }
                            if (line.match(/failed to remove matching tunnels/)) {
                                // Either: no connection, or bad authentication
                                line = "could not authenticate your account with Sauce Labs"
                                    + (apiURL ? " at " + apiURL : ""); 
                            }
                            error = error ? error + "\n" + line : line;
                        }
                    }
                });
                
                function tryRestart(error) {
                    if (!error) {
                        tries = 0;
                        error = "exited without error";
                    }
                    if (tries++ >= MAX_TRIES)
                        return fatalError(error);
                    console.log("[sauce_connect] retrying (" + error + ")");
                    setTimeout(startProcess, 500 + tries * 1500);
                }
            
                function fatalError(error) {
                    emit("started", { error: error });
                    isActivated = false;
                }
            }
        }
        
        function stop() {
            isActive = isActivated = false;
            if (process)
               process.kill();
        }
        
        plugin.on("load", function() {
            load();
        });
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * Starts Sauce Connect. Can be called any number of times.
             * 
             * @param {Function} callback
             * @param {String} callback.err
             */
            start: start,
            
            /**
             * Returns whether our Sauce Connect connection is
             * active and working.
             */
            isActive: function() { return isActive || ASSUME_CONNECTED; },
            
            /**
             * @ignore
             */
            getProcessOutput: function() { return processOutput; },
            
            /**
             * Stops Sauce Connect.
             */
            stop: stop
        });
        
        register(null, { "preview.saucelabs.connect" : plugin });
    }
});