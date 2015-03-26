/*
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "language", "proc", "fs", "tabManager", "save",
        "watcher", "tree", "dialog.error"
    ];
    main.provides = ["language.worker_util_helper"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var language = imports.language;
        var proc = imports.proc;
        var fs = imports.fs;
        var tabs = imports.tabManager;
        var save = imports.save;
        var watcher = imports.watcher;
        var tree = imports.tree;
        var showError = imports["dialog.error"].show;
        var syntaxDetector = require("./syntax_detector");

        var readFileQueue = [];
        var readFileBusy = false;
        var worker;
        var watched = {};
        
        var loaded;
        function load() {
            if (loaded) return;
            loaded = true;
    
            language.getWorker(function(err, _worker) {
                if (err)
                    return console.error(err);
                
                worker = _worker;
                worker.on("watchDir", watchDir);
                worker.on("unwatchDir", unwatchDir);
                watcher.on("unwatch", onWatchRemoved);
                watcher.on("directory", onWatchChange);
                worker.on("refreshAllMarkers", language.refreshAllMarkers.bind(language));
                
                worker.on("execFile", function(e) {
                    ensureConnected(
                        proc.execFile.bind(proc, e.data.path, e.data.options),
                        function(err, stdout, stderr) {
                            worker.emit("execFileResult", { data: {
                                id: e.data.id,
                                err: err,
                                stdout: stdout,
                                stderr: stderr
                            }});
                        }
                    );
                });
                
                worker.on("readFile", function tryIt(e) {
                    readTabOrFile(e.data.path, {
                        encoding: e.data.encoding
                    }, function(err, value) {
                        if (err && err.code === "EDISCONNECT")
                            return ensureConnected(tryIt.bind(null, e));
                        worker.emit("readFileResult", { data: {
                            id: e.data.id,
                            err: err && JSON.stringify(err),
                            data: value
                        }});
                    });
                });
                
                worker.on("stat", function(e) {
                    ensureConnected(function tryIt() {
                        fs.stat(e.data.path, function(err, value) {
                            if (err && err.code === "EDISCONNECT")
                                return ensureConnected(tryIt);
                            worker.emit("statResult", { data: {
                                id: e.data.id,
                                err: err && JSON.stringify(err),
                                data: value
                            }});
                        });
                    });
                });

                worker.on("showError", function(e) {
                    showError(e.data.message, e.data.timeout);
                });
                
                worker.on("getTokens", function(e) {
                    var path = e.data.path;
                    var identifiers = e.data.identifiers;
                    var region = e.data.region;
                    
                    var tab = tabs.findTab(path);
                    if (!tab || !tab.editor || !tab.editor.ace)
                        return done("Tab is no longer open");
                    
                    var session = tab.editor.ace.getSession();
                    var results = [];
                    for (var i = 0, len = session.getLength(); i < len; i++) {
                        if (region && !(region.sl <= i && i <= region.el))
                            continue;
                        var offset = 0;
                        session.getTokens(i).forEach(function(t) {
                            var myOffset = offset;
                            offset += t.value.length;
                            if (identifiers && identifiers.indexOf(t.value) === -1)
                                return;
                            if (region && region.sl === i && myOffset < region.sc)
                                return;
                            if (region && region.el === i && myOffset > region.ec)
                                return;
                            var result = {
                                row: i,
                                column: myOffset
                            };
                            if (region)
                                result = syntaxDetector.posToRegion(region, result);
                            result.value = t.value;
                            results.push(result);
                        });
                    }
                    done(null, results);
                    
                    function done(err, results) {
                        worker.emit("getTokensResult", { data: {
                            id: e.data.id,
                            err: err,
                            results: results
                        }});
                    }
                });
            });
        }
        
        function ensureConnected(f, callback, timeout) {
            timeout = timeout || 200;
            if (!c9.NETWORK) {
                return c9.once("stateChange", function(e) {
                    setTimeout(
                        ensureConnected.bind(null, f, callback, timeout * 2),
                        timeout
                    );
                });
            }
            f(function(err) {
                if (err && err.code === "EDISCONNECT")
                    return ensureConnected(f, callback, timeout);
                callback.apply(null, arguments);
            });
        }
        
        function readTabOrFile(path, options, callback) {
            var allowUnsaved = options.allowUnsaved;
            delete options.allowUnsaved;
            
            var tab = tabs.findTab(path);
            if (tab) {
                if (allowUnsaved) {
                    var unsavedValue = tab.value
                        || tab.document && tab.document.hasValue && tab.document.hasValue()
                           && tab.document.value;
                    if (unsavedValue)
                        return callback(null, unsavedValue);
                }
                else {
                    var saved = save.getSavingState(tab) === "saved";
                    var value = saved
                        ? tab.value || tab.document && tab.document.value
                        : tab.document.meta && typeof tab.document.meta.$savedValue === "string"
                          && tab.document.meta.$savedValue;
                    if (value)
                        return callback(null, value);
                }
                
            }
            
            if (!options.encoding)
                options.encoding = "utf8"; // TODO: get from c9?

            if (readFileBusy)
                return readFileQueue.push(startDownload);
            
            readFileBusy = true;
            startDownload();

            function startDownload() {
                ensureConnected(
                    function(next) {
                        fs.exists(path, function(exists) {
                            if (!exists) {
                                var err = new Error("Does not exist: " + path);
                                err.code = "ENOENT";
                                return next(err);
                            }
                            fs.readFile(path, options, next);
                        });
                    },
                    function(err, result) {
                        callback(err, result);
                        
                        if (!readFileQueue.length)
                            return readFileBusy = false;
                        var task = readFileQueue.pop();
                        task();
                    }
                );
            }
        }
    
        function watchDir(e) {
            var path = e.data.path;
            watcher.watch(path);
            watched[path] = true;
        }
        
        function unwatchDir(e) {
            var path = e.data.path;
            watched[path] = false;
            // HACK: don't unwatch if visible in tree
            if (tree.getAllExpanded().indexOf(path) > -1)
                return;
            watcher.unwatch(path);
        }
        
        function onWatchRemoved(e) {
            // HACK: check if someone removed my watcher
            if (watched[e.path])
                watchDir({ data: { path: e.path } });
        }
        
        function onWatchChange(e) {
            if (watched[e.path])
                worker.emit("watchDirResult", { data: e });
        }
        
        plugin.on("load", function() {
            load();
        });
        
        plugin.freezePublicAPI({
            readTabOrFile: readTabOrFile
        });
        
        register(null, {
            "language.worker_util_helper": plugin
        });
    }

});