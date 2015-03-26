/**
 * jsonalyzer server-side analysis component
 */
var vm = require("vm");
var Module = require("module");
var dirname = require("path").dirname;
var assert = require("assert");
var collabServer;

var plugins = {
    "c9/assert": assert
};
var vfs;
var handlers = {};

module.exports = function(_vfs, options, register) {
    vfs = _vfs;
    
    register(null, {
        init: init,
        
        registerHandler: registerHandler,
        
        registerHandlers: registerHandlers,
        
        callHandler: callHandler,
        
        getHandlerList: getHandlerList
    });
};

function init(options, callback) {
    if (!options.useCollab)
        return callback();

    vfs.use("collab", {}, function(err, collab) {
        if (err)
            return callback(err);
        collabServer = collab.api;
        callback();
    });
}

function getClientDoc(path, options, callback) {
    if (options.value)
        return done(null, { contents: options.value });
    
    if (!collabServer)
        return done(new Error("No collab server found and cannot use local value"));

    var timeout = setTimeout(function() {
        done(new Error("Collab server failed to provide document contents"));
    }, 20000);

    var docId = path.replace(/^\//, "");
    collabServer.getDocument(
        docId,
        /*["revNum"],*/
        function(err, result) {
            if (err) return done(err);
            if (!result) return done(new Error(new Error("Unable to open document or document not found")));
            
            if (options.revNum <= result.revNum)
                return collabServer.getDocument(docId, ["revNum", "contents"], done);
            
            collabServer.emitter.on("afterEditUpdate", function wait(e) {
                if (e.docId !== docId || e.doc.revNum < options.revNum)
                    return;
                collabServer.emitter.removeListener("afterEditUpdate", wait);
                done(null, e.doc);
            });
        }
    );
    
    function done(err, doc) {
        clearTimeout(timeout);
        callback(err, doc);
    }
}

function registerHandlers(list, options, callback) {
    var results = [];
    async.forEachSeries(
        list,
        function(plugin, next) {
            registerHandler(
                plugin.path,
                plugin.contents,
                plugin.options || options,
                function(err, result) {
                    results.push(result);
                    next(err);
                }
            );
        },
        function(err) {
            return callback(err, { summaries: results });
        }
    );
}

function registerHandler(handlerPath, contents, options, callback) {
    loadPlugin(handlerPath, contents, function(err, result) {
        if (err) return callback(err);
        
        handlers[handlerPath] = result;

        if (!result.init)
            return done();
        
        result.init(options, done);
        
        function done(err) {
            if (err) return callback(err);
            
            callback(null, getHandlerSummary(handlerPath, result));
        }
    });
}

function getHandlerSummary(path, handler) {
    var properties = {};
    var functions = {};
    for (var p in handler) {
        if (!handler.hasOwnProperty(p))
            continue;
        // We don't send functions over vfs, but use callHandler() instead
        if (typeof handler[p] === "function")
            functions[p] = true;
        else
            properties[p] = handler[p];
    }
    
    return {
        path: path,
        properties: properties,
        functions: functions
    };
}

function getHandlerList(callback) {
    callback(null, { handlers: Object.keys(handlers) });
}

function arrayToObject(array) {
    var obj = {};
    for (var i = 0; i < array.length; i++) {
        obj[array[i]] = true;
    }
    return obj;
}

function callHandler(handlerPath, method, args, options, callback) {
    var handler = handlers[handlerPath];
    if (!handler)
        return callback(new Error("No such handler: " + handlerPath));
    if (!handler[method])
        return callback(new Error("No such method on " + handlerPath + ": " + method));

    var revNum;
    var isDone;

    // We need to catch any errors thrown by  the handler or collab to make
    // sure we never crash.
    try {
        setupCall();
    } catch (e) {
        if (isDone)
            throw e;
        done(e);
    }
    
    function setupCall() {
        switch (method) {
            case "analyzeCurrent":
            case "findImports":
                var clientPath = args[0];
                var osPath = options.filePath;
                
                getClientDoc(clientPath, options, function(err, doc) {
                    if (err) return done(err);
                    if (!doc) {
                        // Document doesn't appear to exist in collab;
                        // we'll pass null instead and wait for the
                        // plugin to decide what to do.
                        revNum = -1;
                        return doCall();
                    }
                    
                    args[0] = osPath;
                    args[1] = doc.contents;
                    args[3] = args[3] || {}; // options
                    args[3].clientPath = clientPath;
                    revNum = doc.revNum;
                    doCall();
                });
                break;
            default:
                doCall();
        }
    }
    
    function doCall() {
        handler[method].apply(handler, args.concat(done));
    }
    
    function done(err) {
        isDone = true;
        if (err) return callback(err);
        
        return callback(
            null,
            {
                result: [].slice.apply(arguments),
                revNum: revNum
            }
        );
    }
}

function loadPlugin(path, contents, callback) {
    var sandbox = {};
    var exports = {};
    
    if (!path || path.match(/^\.|\.js$/))
        return callback(new Error("Illegal module name: " + path));
    if (!contents)
        return callback(new Error("No contents provided: " + path));

    sandbox.exports = exports;
    sandbox.module = {
        exports: exports
    };
    sandbox.global = sandbox;
    sandbox.require = createRequire(path, plugins);
    sandbox.console = console;
    sandbox.process = process;
    sandbox.setTimeout = setTimeout;
    sandbox.setInterval = setInterval;
    sandbox.clearTimeout = clearTimeout;
    sandbox.clearInterval = clearInterval;
    sandbox.define = function(def) {
        def(sandbox.require, sandbox.exports, sandbox.module);
    };
    
    try {
        var script = vm.createScript(contents.replace(/^\#\!.*/, ''), path);
        var pathJS = path.replace(/(\.js)?$/, ".js");
        script.runInNewContext(sandbox, pathJS);
    } catch (e) {
        console.error("Error loading " + path + ":", e.stack);
        e.message = ("Error loading " + path + ": " + e.message);
        return callback(e);
    }

    plugins[path] = sandbox.module.exports;
    callback(null, sandbox.module.exports);
}

function createRequire(path, localDefs) {
    var parentModule = new Module(path);
    parentModule.path = path;
    parentModule.paths = Module._nodeModulePaths(dirname(path));

    function createRequire(file) {
        var normalized = normalizeModule(path, file);
        if (normalized in localDefs)
            return localDefs[normalized];
        // TODO: fix relative path requires
        try {
            var exports = Module._load(file, parentModule);
            return exports;
        } catch (e) {
            e.message = path + ": " + e.message;
            throw e;
        }
    }

    createRequire.resolve = function(request) {
        var resolved = Module._resolveFilename(request, parentModule);
        return (resolved instanceof Array) ? resolved[1] : resolved;
    };

    createRequire.main = process.mainModule;
    createRequire.extensions = require.extensions;
    createRequire.cache = require.cache;

    return createRequire;
}

function normalizeModule(parentId, moduleName) {
    // normalize plugin requires
    if (moduleName.indexOf("!") !== -1) {
        var chunks = moduleName.split("!");
        return normalizeModule(parentId, chunks[0]) + "!" + normalizeModule(parentId, chunks[1]);
    }
    // normalize relative requires
    if (moduleName.charAt(0) == ".") {
        var base = parentId.split("/").slice(0, -1).join("/");
        moduleName = (base || parentId) + "/" + moduleName;

        while (moduleName.indexOf(".") !== -1 && previous != moduleName) {
            var previous = moduleName;
            moduleName = moduleName.replace(/\/\.\//, "/").replace(/[^\/]+\/\.\.\//, "");
        }
    }

    return moduleName;
}

var async = {
    forEachSeries: function(arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    }
};