/**
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
/**
 * Language Worker
 * This code runs in a WebWorker in the browser. Its main job is to
 * delegate messages it receives to the various handlers that have registered
 * themselves with the worker.
 */
define(function(require, exports, module) {

var oop = require("ace/lib/oop");
var Mirror = require("ace/worker/mirror").Mirror;
var tree = require('treehugger/tree');
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;
var syntaxDetector = require("plugins/c9.ide.language/syntax_detector");
var completeUtil = require("plugins/c9.ide.language/complete_util");
var base_handler = require("./base_handler");
var assert = require("c9/assert");

require("plugins/c9.ide.browsersupport/browsersupport");

var isInWebWorker = typeof window == "undefined" || !window.location || !window.document;

var WARNING_LEVELS = {
    error: 3,
    warning: 2,
    info: 1
};

var UPDATE_TIMEOUT_MIN = !isInWebWorker && window.c9Test ? 5 : 200;
var UPDATE_TIMEOUT_MAX = 15000;
var DEBUG = !isInWebWorker; // set to true by setDebug() for c9.dev/cloud9beta.com
var STATS = false;

// Leaking into global namespace of worker, to allow handlers to have access
/*global disabledFeatures: true*/
disabledFeatures = {};

var ServerProxy = function(sender) {

  this.emitter = Object.create(EventEmitter);
  this.emitter.emit = this.emitter._dispatchEvent;

  this.send = function(data) {
      sender.emit("serverProxy", data);
  };

  this.once = function(messageType, messageSubtype, callback) {
    var channel = messageType;
    if (messageSubtype)
       channel += (":" + messageSubtype);
    this.emitter.once(channel, callback);
  };

  this.subscribe = function(messageType, messageSubtype, callback) {
    var channel = messageType;
    if (messageSubtype)
       channel += (":" + messageSubtype);
    this.emitter.addEventListener(channel, callback);
  };

  this.unsubscribe = function(messageType, messageSubtype, f) {
    var channel = messageType;
    if (messageSubtype)
       channel += (":" + messageSubtype);
    this.emitter.removeEventListener(channel, f);
  };

  this.onMessage = function(msg) {
    var channel = msg.type;
    if (msg.subtype)
      channel += (":" + msg.subtype);
    // console.log("publish to: " + channel);
    this.emitter.emit(channel, msg.body);
  };
};

exports.createUIWorkerClient = function() {
    var emitter = Object.create(require("ace/lib/event_emitter").EventEmitter);
    var result = new LanguageWorker(emitter);
    result.on = function(name, f) {
        emitter.on.call(result, name, f);
    };
    result.once = function(name, f) {
        emitter.once.call(result, name, f);
    };
    result.removeEventListener = function(f) {
        emitter.removeEventListener.call(result, f);
    };
    result.call = function(cmd, args, callback) {
        if (callback) {
            var id = this.callbackId++;
            this.callbacks[id] = callback;
            args.push(id);
        }
        this.send(cmd, args);
    };
    result.send = function(cmd, args) {
        setTimeout(function() { result[cmd].apply(result, args); }, 0);
    };
    result.emit = function(event, data) {
        emitter._dispatchEvent.call(emitter, event, data);
    };
    emitter.emit = function(event, data) {
        emitter._dispatchEvent.call(result, event, { data: data });
    };
    result.changeListener = function(e) {
        this.emit("change", {data: [e.data]});
    }; 
    return result;
};

var LanguageWorker = exports.LanguageWorker = function(sender) {
    var _self = this;
    this.handlers = [];
    this.$warningLevel = "info";
    this.$openDocuments = {};
    this.$initedRegexes = {};
    sender.once = EventEmitter.once;
    this.serverProxy = new ServerProxy(sender);

    Mirror.call(this, sender);
    this.setTimeout(0);
    exports.sender = sender;
    exports.$lastWorker = this;

    sender.on("hierarchy", function(event) {
        _self.hierarchy(event);
    });
    sender.on("code_format", function(event) {
        _self.codeFormat();
    });
    sender.on("outline", applyEventOnce(function(event) {
        _self.outline(event);
    }));
    sender.on("complete", applyEventOnce(function(data) {
        _self.complete(data);
    }), true);
    sender.on("documentClose", function(event) {
        _self.documentClose(event);
    });
    sender.on("analyze", applyEventOnce(function(event) {
        _self.analyze(false, function() {});
    }));
    sender.on("cursormove", function(event) {
        _self.onCursorMove(event);
    });
    sender.on("inspect", applyEventOnce(function(event) {
        _self.inspect(event);
    }));
    sender.on("jumpToDefinition", applyEventOnce(function(event) {
        _self.jumpToDefinition(event);
    }));
    sender.on("isJumpToDefinitionAvailable", applyEventOnce(function(event) {
        _self.isJumpToDefinitionAvailable(event);
    }));
    sender.on("refactorings", function(event) {
        _self.getRefactorings(event);
    });
    sender.on("renamePositions", function(event) {
        _self.getRenamePositions(event);
    });
    sender.on("onRenameBegin", function(event) {
        _self.onRenameBegin(event);
    });
    sender.on("commitRename", function(event) {
        _self.commitRename(event);
    });
    sender.on("onRenameCancel", function(event) {
        _self.onRenameCancel(event);
    });
    sender.on("serverProxy", function(event) {
        _self.serverProxy.onMessage(event.data);
    });
};

/**
 * Ensure that an event handler is called only once if multiple
 * events are received at roughly the same time.
 **/
function applyEventOnce(eventHandler, waitForMirror) {
    var timer;
    var mirror = this;
    return function() {
        var _arguments = arguments;
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(function() {
            if (waitForMirror && mirror.isPending())
                return setTimeout(function() { applyEventOnce(eventHandler, true) }, 0);
            eventHandler.apply(eventHandler, _arguments);
        }, 0);
    };
}

oop.inherits(LanguageWorker, Mirror);

var asyncForEach = module.exports.asyncForEach = function(array, fn, test, callback) {
    if (!callback) {
        callback = test;
        test = null;
    }

    array = array.slice(); // copy before use
    
    var nested = false, callNext = true;
    loop();
    
    function loop() {
        while (callNext && !nested) {
            callNext = false;
            while (array.length > 0 && test && !test(array[0]))
                array.shift();

            var item = array.shift();
            // TODO: implement proper err argument?
            if (!item)
                return callback && callback();

            nested = true;
            fn(item, loop);
            nested = false;
        }
        callNext = true;
    }
};

function startTime() {
    if (!STATS)
        return;
    
    return Date.now();
}

function endTime(t, message, indent) {
    if (!STATS)
        return;

    var spaces = indent ? indent * 2 : 0;
    var time = String(Date.now() - t);
    spaces += Math.max(4 - time.length, 0);
    var prefix = "";
    for (var i = 0; i < spaces; i++)
        prefix += " ";

    console.log(prefix + time, message);
}

(function() {
    
    this.enableFeature = function(name, value) {
        disabledFeatures[name] = !value;
    };

    this.setWarningLevel = function(level) {
        this.$warningLevel = level;
    };
    
    this.setStaticPrefix = completeUtil.setStaticPrefix;

    this.setDebug = function(value) {
        DEBUG = value;
    };

    /**
     * Registers a handler by loading its code and adding it the handler array
     */
    this.register = function(path, contents, callback) {
        var _self = this;
        function onRegistered(handler) {
            handler.$source = path;
            handler.proxy = _self.serverProxy;
            handler.sender = _self.sender;
            handler.$isInited = false;
            _self.handlers.push(handler);
            _self.$initHandler(handler, null, true, function() {
                // Note: may not return for a while for asynchronous workers,
                //       don't use this for queueing other tasks
                _self.sender.emit("registered", { path: path });
                callback && callback();
            });
        }
        if (contents) {
            // In the context of this worker, we can't use the standard
            // require.js approach of using <script/> tags to load scripts,
            // but need to load them from the local domain or from text
            // instead. For now, we'll just load external plugins from text;
            // the UI thread'll have to provide them in that format.
            // Note that this indirect eval call evaluates in the (worker)
            // global context.
            try {
                eval.call(null, contents);
            } catch (e) {
                console.error("Could not load language handler " + path + ": " + e);
                _self.sender.emit("registered", { path: path, err: e });
                callback && callback(e);
                throw e;
            }
        }
        var handler;
        try {
            handler = require(path);
            if (!handler)
                throw new Error("Unable to load required module: " + path);
        } catch (e) {
            if (isInWebWorker) {
                console.error("Could not load language handler " + path + ": " + e);
                _self.sender.emit("registered", { path: path, err: e.message });
                callback && callback(e);
                throw e;
            }
            // In ?noworker=1 debugging mode, synchronous require doesn't work
            require([path], function(handler) {
                if (!handler) {
                    _self.sender.emit("registered", { path: path, err: "Could not load" });
                    callback && callback("Could not load");
                    throw new Error("Could not load language handler " + path);
                }
                onRegistered(handler);
            });
            return;
        }
        onRegistered(handler);
    };

    this.asyncForEachHandler = function(options, fn, callback) {
        var that = this;
        var part = options.part;
        var method = options.method;
        var ignoreSize = options.ignoreSize;
        asyncForEach(
            this.handlers,
            fn,
            function(handler) {
                return that.isHandlerMatch(handler, part, method, ignoreSize);
            },
            callback
        );
    };
    
    this.isHandlerMatch = function(handler, part, method, ignoreSize) {
        if (!handler[method]) {
            reportError(new Error("Handler " + handler.$source + " does not have method " + method));
            return false;
        }
        if (handler[method].base_handler)
            return;
        switch (handler.handlesEditor()) {
            case base_handler.HANDLES_EDITOR: 
                if (this.immediateWindow)
                    return;
                break; 
            case base_handler.HANDLES_IMMEDIATE:
                if (!this.immediateWindow)
                    return;
        }
        if (!handler.handlesLanguage(part ? part.language : this.$language, part))
            return;
        var docLength = ignoreSize ? null : part
            ? part.getValue().length
            : this.doc.$lines.reduce(function(t,l) { return t + l.length; }, 0);
        return ignoreSize || docLength < handler.getMaxFileSizeSupported();
    };

    this.parse = function(part, callback, allowCached, forceCached) {
        var value = (part || this.doc).getValue();
        var language = part ? part.language : this.$language;

        if (allowCached && this.cachedAsts) {
            var cached = this.cachedAsts[part.index];
            if (cached && cached.ast && cached.part.language === language)
                return callback(cached.ast);
        }
        if (forceCached)
            return callback(null);

        var resultAst = null;
        this.asyncForEachHandler(
            { part: part, method: "parse" },
            function parseNext(handler, next) {
                handler.parse(value, function onParse(ast) {
                    if (ast)
                        resultAst = ast;
                    next();
                });
            },
            function() {
                callback(resultAst);
            }
        );
    };

    /**
     * Finds the current node using the language handler.
     * This should always be preferred over the treehugger findNode()
     * method.
     * 
     * @param pos.row
     * @param pos.column
     */
    this.findNode = function(ast, pos, callback) {
        if (!ast)
            return callback();

        // Sanity check for old-style pos objects
        assert(!pos.line, "Internal error: providing line/col instead of row/column");
        
        var _self = this;
        var part = syntaxDetector.getContextSyntaxPart(_self.doc, pos, _self.$language);
        if (!part)
            return; // cursor position no longer current
        var posInPart = syntaxDetector.posToRegion(part.region, pos);
        var result;
        this.asyncForEachHandler(
            { part: part, method: "findNode" },
            function(handler, next) {
                handler.findNode(ast, posInPart, function(node) {
                    if (node)
                        result = node;
                    next();
                });
            },
            function() { callback(result); }
        );
    };

    this.outline = function(event) {
        var _self = this;
        this.getOutline(function(result, isUnordered) {
            _self.sender.emit(
                "outline",
                {
                    body: result && (result.body || result.items) || [],
                    path: _self.$path,
                    isUnordered: isUnordered
                }
            );
        });
    };
    
    this.getOutline = function(callback) {
        var _self = this;
        var result;
        var isUnordered = false;
        this.parse(null, function(ast) {
            asyncForEach(_self.handlers, function(handler, next) {
                if (_self.isHandlerMatch(handler, null, "outline")) {
                    handler.outline(_self.doc, ast, function(outline) {
                        if (outline && (!result || result.isGeneric))
                            result = outline;
                        isUnordered = isUnordered || outline && outline.isUnordered;
                        next();
                    });
                }
                else
                    next();
            }, function() {
                callback(result, isUnordered);
            });
        });
    };

    this.hierarchy = function(event) {
        var data = event.data;
        var _self = this;
        asyncForEach(this.handlers, function(handler, next) {
            if (_self.isHandlerMatch(handler, null, "hierarchy")) {
                handler.hierarchy(_self.doc, data.pos, function(hierarchy) {
                    if (hierarchy)
                        return _self.sender.emit("hierarchy", hierarchy);
                    else
                        next();
                });
            }
            else
                next();
        });
    };

    this.codeFormat = function() {
        var _self = this;
        asyncForEach(_self.handlers, function(handler, next) {
            if (_self.isHandlerMatch(handler, null, "codeFormat", true)) {
                handler.codeFormat(_self.doc, function(newSource) {
                    if (newSource)
                        return _self.sender.emit("code_format", newSource);
                    else
                        next();
                });
            }
            else
                next();
        });
    };

    this.scheduleEmit = function(messageType, data) {
        // todo: sender must set the path
        data.path = this.$path;
        this.sender.emit(messageType, data);
    };

    /**
     * If the program contains a syntax error, the parser will try its best to still produce
     * an AST, although it will contain some problems. To avoid that those problems result in
     * invalid warning, let's filter out warnings that appear within a line or too after the
     * syntax error.
     */
    function filterMarkersAroundError(ast, markers) {
        if (!ast || !ast.getAnnotation)
            return;
        var error = ast.getAnnotation("error");
        if (!error)
            return;
        for (var i = 0; i < markers.length; i++) {
            var marker = markers[i];
            if (marker.type !== 'error' && marker.pos.sl >= error.line && marker.pos.el <= error.line + 2) {
                markers.splice(i, 1);
                i--;
            }
        }
    }

    this.analyze = function(minimalAnalysis, callback) {
        var _self = this;
        var parts = syntaxDetector.getCodeParts(this.doc, this.$language);
        var markers = [];
        var cachedAsts = {};
        var t0 = startTime();
        asyncForEach(parts, function analyzePart(part, nextPart) {
            var partMarkers = [];
            _self.part = part;
            _self.parse(part, function analyzeParsed(ast) {
                cachedAsts[part.index] = {part: part, ast: ast};

                _self.asyncForEachHandler(
                    { part: part, method: "analyze" },
                    function(handler, next) {
                        handler.language = part.language;
                        var t = startTime();
                        _self.$lastAnalyzer = handler.$source;
                        handler.analyze(part.getValue(), ast, function(result) {
                            endTime(t, "Analyze: " + handler.$source.replace("plugins/", ""));
                            if (result) {
                                handler.getResolutions(part.getValue(), ast, result, function(result2) {
                                    if (result2) {
                                        partMarkers = partMarkers.concat(result2);
                                    } else {
                                        partMarkers = partMarkers.concat(result);
                                    }
                                    next();
                                });
                            }
                            else {
                                next();
                            }
                        }, minimalAnalysis);
                    },
                    function () {
                        filterMarkersAroundError(ast, partMarkers);
                        var region = part.region;
                        partMarkers.forEach(function (marker) {
                            if (marker.skipMixed)
                                return;
                            var pos = marker.pos;
                            pos.sl = pos.el = pos.sl + region.sl;
                            if (pos.sl === region.sl) {
                                pos.sc += region.sc;
                                pos.ec += region.sc;
                            }
                        });
                        markers = markers.concat(partMarkers);
                        nextPart();
                    }
                );
            });
        }, function() {
            endTime(t0, "Analyzed all");
            _self.cachedAsts = cachedAsts;
            if (!minimalAnalysis) {
                _self.scheduleEmit("markers", _self.filterMarkersBasedOnLevel(markers));
            }
            callback();
        });
    };

    this.filterMarkersBasedOnLevel = function(markers) {
        if (disabledFeatures.hints)
            return [];
        for (var i = 0; i < markers.length; i++) {
            var marker = markers[i];
            if (marker.level && WARNING_LEVELS[marker.level] < WARNING_LEVELS[this.$warningLevel]) {
                markers.splice(i, 1);
                i--;
            }
        }
        return markers;
    };

    this.getPart = function (pos) {
        return syntaxDetector.getContextSyntaxPart(this.doc, pos, this.$language);
    };
    
    /**
     * Request the AST node on the current position
     */
    this.inspect = function (event) {
        var _self = this;
        var pos = { row: event.data.row, column: event.data.column };
        var part = this.getPart({ row: event.data.row, column: event.data.col });
        if (!part)
            return; // cursor position no longer current
        var partPos = syntaxDetector.posToRegion(part.region, pos);
        this.parse(part, function(ast) {
            _self.findNode(ast, pos, function(node) {
                _self.getPos(node, function(fullPos) {
                    if (!fullPos) {
                        var postfix = completeUtil.retrieveFollowingIdentifier(_self.doc.getLine(pos.row), pos.column);
                        var prefix = completeUtil.retrievePrecedingIdentifier(_self.doc.getLine(pos.row), pos.column);
                        fullPos = { sl: partPos.row, sc: partPos.column - prefix.length, el: partPos.row, ec: partPos.column + postfix.length };
                    }
                    _self.nodeToString(node, function(result) {
                        // Begin with a simple string representation
                        var lastResult = {
                            pos: fullPos,
                            value: result
                        };
                        var rejected;
                        
                        // Try and find a better match using getInspectExpression()
                        asyncForEach(_self.handlers, function(handler, next) {
                            if (_self.isHandlerMatch(handler, part, "getInspectExpression")) {
                                handler.language = part.language;
                                handler.getInspectExpression(part, ast, partPos, node, function(result) {
                                    if (result) {
                                        result.pos = syntaxDetector.posFromRegion(part.region, result.pos);
                                        lastResult = result || lastResult;
                                    }
                                    else if (!rejected) {
                                        lastResult = {};
                                        rejected = true;
                                    }
                                    next();
                                });
                            }
                            else {
                                next();
                            }
                        }, function () {
                            if (!lastResult.pos && !lastResult.value)
                                return _self.scheduleEmit("inspect", lastResult);
                            
                            // if we have real pos, just get the value from document
                            var pos = lastResult.pos;
                            var text = _self.doc.getTextRange({start: {column: pos.sc, row: pos.sl}, end: {column: pos.ec, row: pos.el}});
                            if (text != lastResult.value) {
                                console.warn("inspect expected ", text, " got ", lastResult.value);
                                lastResult.value = text;
                            }
                            _self.scheduleEmit("inspect", lastResult);
                        });
                    });
                });
            });
        }, true);
    };
    
    this.nodeToString = function(node, callback) {
        if (!node)
            return callback();
        var _self = this;
        this.getPos(node, function(pos) {
            if (!pos)
                return callback();
            var doc = _self.doc;
            if (pos.sl === pos.el)
                return callback(doc.getLine(pos.sl).substring(pos.sc, pos.ec));
            
            var result = doc.getLine(pos.sl).substr(pos.sc);
            for (var i = pos.sl + 1; i < pos.el; i++) {
                result += doc.getLine(i);
            }
            result += doc.getLine(pos.el).substr(0, pos.ec);
            callback(result);
        });
    };
    
    this.getPos = function(node, callback) {
        if (!node)
            return callback();
        var done = false;
        var _self = this;
        this.handlers.forEach(function (h) {
            if (!done && _self.isHandlerMatch(h, null, "getPos", true)) {
                h.getPos(node, function(result) {
                    if (!result)
                        return;
                    done = true;
                    callback(result);
                });
            }
        });
        if (!done)
            callback();
    };
    
    this.getIdentifierRegex = function(pos) {
        var part = this.getPart(pos || { row: 0, column: 0 });
        var result;
        var _self = this;
        this.handlers.forEach(function (h) {
            if (_self.isHandlerMatch(h, part, "getIdentifierRegex", true))
                result = h.getIdentifierRegex() || result;
        });
        return result || completeUtil.DEFAULT_ID_REGEX;
    };

    /**
     * Process a cursor move.
     */
    this.onCursorMove = function(event) {
        var _self = this;
        var pos = event.data.pos;
        var part = this.getPart(pos);
        if (!part)
            return; // cursor position no longer current
        var line = this.doc.getLine(pos.row);
        
        if (line != event.data.line) {
            // Our intelligence is outdated, tell the client
            return this.scheduleEmit("hint", { line: null });
        }

        var result = {
            markers: [],
            hint: null,
            displayPos: null
        };
        
        this.initAllRegexes(part.language);
        
        var posInPart = syntaxDetector.posToRegion(part.region, pos);
        this.parse(part, function(ast) {
            if (!ast)
                return callHandlers(ast, null, posInPart);
            _self.findNode(ast, pos, function(currentNode) {
                callHandlers(ast, currentNode, posInPart);
            });
        }, true, true);
        
        function callHandlers(ast, currentNode) {
            asyncForEach(_self.handlers,
                function(handler, next) {
                    if ((pos != _self.lastCurrentPosUnparsed || pos.force) && _self.isHandlerMatch(handler, part, "onCursorMove")) {
                        handler.onCursorMove(part, ast, posInPart, currentNode, function(response) {
                            processCursorMoveResponse(response, part, result);
                            next();
                        });
                    }
                    else {
                        next();
                    }
                },
                function() {
                    // Send any results so far
                    _self.lastCurrentPosUnparsed = pos;
                    if (result.markers.length) {
                        _self.scheduleEmit("highlightMarkers", disabledFeatures.instanceHighlight
                            ? []
                            : result.markers
                        );
                        event.data.addedMarkers = result.markers;
                    }
                    if (result.hint !== null) {
                        _self.scheduleEmit("hint", {
                            pos: result.pos,
                            displayPos: result.displayPos,
                            message: result.hint,
                            line: line
                        });
                    }
                    
                    // Parse, analyze, and get more results
                    _self.onCursorMoveAnalyzed(event);
                }
            );
        }
    };
    
    /**
     * Perform tooltips/marker analysis after a cursor moved,
     * once the document has been parsed & analyzed.
     */
    this.onCursorMoveAnalyzed = function(event) {
        var _self = this;
        var pos = event.data.pos;
        var part = this.getPart(pos);
        if (!part)
            return; // cursor position no longer current
        var line = this.doc.getLine(pos.row);
        
        if (line != event.data.line) {
            // Our intelligence is outdated, tell the client
            return this.scheduleEmit("hint", { line: null });
        }
        if (this.updateScheduled) {
            // Postpone the cursor move until the update propagates
            this.postponedCursorMove = event;
            if (event.data.now)
                this.onUpdate(true);
            return;
        }

        var result = {
            markers: event.data.addedMarkers || [],
            hint: null,
            displayPos: null
        };

        var posInPart = syntaxDetector.posToRegion(part.region, pos);
        this.parse(part, function(ast) {
            _self.findNode(ast, pos, function(currentNode) {
                if (pos != _self.lastCurrentPos || currentNode !== _self.lastCurrentNode || pos.force) {
                    callHandlers(ast, currentNode);
                }
            });
        }, true);
        
        function callHandlers(ast, currentNode) {
            asyncForEach(_self.handlers, function(handler, next) {
                if (_self.updateScheduled) {
                    // Postpone the cursor move until the update propagates
                    _self.postponedCursorMove = event;
                    return;
                }
                if (_self.isHandlerMatch(handler, part, "tooltip") || _self.isHandlerMatch(handler, part, "highlightOccurrences")) {
                    // We send this to several handlers that each handle part of the language functionality,
                    // triggered by the cursor move event
                    assert(!handler.onCursorMovedNode, "handler implements onCursorMovedNode; no longer exists");
                    asyncForEach(["tooltip", "highlightOccurrences"], function(method, nextMethod) {
                        handler[method](part, ast, posInPart, currentNode, function(response) {
                            result = processCursorMoveResponse(response, part, result);
                            nextMethod();
                        });
                    }, next);
                }
                else {
                    next();
                }
            }, function() {
                _self.scheduleEmit("highlightMarkers", disabledFeatures.instanceHighlight
                    ? []
                    : result.markers
                );
                _self.lastCurrentNode = currentNode;
                _self.lastCurrentPos = pos;
                _self.scheduleEmit("hint", {
                    pos: result.pos,
                    displayPos: result.displayPos,
                    message: result.hint,
                    line: line
                });
            });
        }
    };
        
    function processCursorMoveResponse(response, part, result) {
        if (!response)
            return result;
        if (response.markers && (!result.markers.found || !response.isGeneric)) {
            if (result.markers.isGeneric)
                result.markers = [];
            result.markers = result.markers.concat(response.markers.map(function (m) {
                var start = syntaxDetector.posFromRegion(part.region, {row: m.pos.sl, column: m.pos.sc});
                var end = syntaxDetector.posFromRegion(part.region, {row: m.pos.el, column: m.pos.ec});
                m.pos = {
                    sl: start.row,
                    sc: start.column,
                    el: end.row,
                    ec: end.column
                };
                return m;
            }));
            result.markers.found = true;
            result.markers.isGeneric = response.isGeneric;
        }
        if (response.hint) {
            if (result.hint)
                result.hint += "\n" + response.hint;
            else
                result.hint = response.hint;
        }
        if (response.pos)
            result.pos = response.pos;
        if (response.displayPos)
            result.displayPos = response.displayPos;
        
        return result;
    }

    this.$getDefinitionDeclarations = function (row, col, callback) {
        var pos = { row: row, column: col };
        var allResults = [];

        var _self = this;
        var part = this.getPart(pos);
        if (!part)
            return; // cursor position no longer current
        var posInPart = syntaxDetector.posToRegion(part.region, pos);

        this.parse(part, function(ast) {
            _self.findNode(ast, pos, function(currentNode) {
                asyncForEach(_self.handlers, function jumptodefNext(handler, next) {
                    if (_self.isHandlerMatch(handler, part, "jumpToDefinition")) {
                        handler.jumpToDefinition(part, ast, posInPart, currentNode, function(results) {
                            handler.path = _self.$path;
                            if (results)
                                allResults = allResults.concat(results);
                            next();
                        });
                    }
                    else {
                        next();
                    }
                }, function () {
                    callback(allResults.map(function (pos) {
                        var globalPos = syntaxDetector.posFromRegion(part.region, pos);
                        pos.row = globalPos.row;
                        pos.column = globalPos.column;
                        return pos;
                    }));
                });
            });
        }, true);
    };

    this.jumpToDefinition = function(event) {
        var _self = this;
        var pos = event.data;
        var line = this.doc.getLine(pos.row);
        var regex = this.getIdentifierRegex(pos);
        var identifier = completeUtil.retrievePrecedingIdentifier(line, pos.column, regex)
            + completeUtil.retrieveFollowingIdentifier(line, pos.column, regex);

        _self.$getDefinitionDeclarations(pos.row, pos.column, function(results) {
            _self.sender.emit(
                "definition",
                {
                    pos: pos,
                    results: results || [],
                    path: _self.$path,
                    identifier: identifier
                }
            );
        });
    };

    this.isJumpToDefinitionAvailable = function(event) {
        var _self = this;
        var pos = event.data;

        _self.$getDefinitionDeclarations(pos.row, pos.column, function(results) {
            _self.sender.emit(
                "isJumpToDefinitionAvailableResult",
                { value: !!(results && results.length), path: _self.$path, pos: pos }
            );
        });
    };
    
    this.getRefactorings = function(event) {
        var _self = this;
        var pos = event.data;
        var part = this.getPart(pos);
        if (!part)
            return; // cursor position no longer current
        var partPos = syntaxDetector.posToRegion(part.region, pos);
        
        this.parse(part, function(ast) {
            _self.findNode(ast, pos, function(currentNode) {
                var result;
                asyncForEach(_self.handlers, function(handler, next) {
                    if (_self.isHandlerMatch(handler, part, "getRefactorings")) {
                        handler.getRefactorings(part, ast, partPos, currentNode, function(response) {
                            if (response) {
                                assert(!response.enableRefactorings, "Use refactorings instead of enableRefactorings");
                                if (!result || result.isGeneric)
                                    result = response;
                            }
                            next();
                        });
                    }
                    else {
                        next();
                    }
                }, function() {
                    _self.sender.emit("refactoringsResult", result && result.refactorings || []);
                });
            });
        });
    };

    this.getRenamePositions = function(event) {
        var _self = this;
        var pos = event.data;
        var part = this.getPart(pos);
        if (!part)
            return; // cursor position no longer current
        var partPos = syntaxDetector.posToRegion(part.region, pos);

        function posFromRegion(pos) {
            return syntaxDetector.posFromRegion(part.region, pos);
        }

        this.parse(part, function(ast) {
            _self.findNode(ast, pos, function(currentNode) {
                var result;
                asyncForEach(_self.handlers, function(handler, next) {
                    if (_self.isHandlerMatch(handler, part, "getRenamePositions")) {
                        assert(!handler.getVariablePositions, "handler implements getVariablePositions, should implement getRenamePositions instead");
                        handler.getRenamePositions(part, ast, partPos, currentNode, function(response) {
                            if (response) {
                                if (!result || result.isGeneric)
                                    result = response;
                            }
                            next();
                        });
                    }
                    else {
                        next();
                    }
                }, function() {
                    if (!result)
                        return _self.sender.emit("renamePositionsResult");
                    result.uses = (result.uses || []).map(posFromRegion);
                    result.declarations = (result.declarations || []).map(posFromRegion);
                    result.others = (result.others || []).map(posFromRegion);
                    result.pos = posFromRegion(result.pos);
                    _self.sender.emit("renamePositionsResult", result);
                });
            });
        }, true);
    };

    this.onRenameBegin = function(event) {
        var _self = this;
        this.handlers.forEach(function(handler) {
            if (_self.isHandlerMatch(handler, null, "onRenameBegin"))
                handler.onRenameBegin(_self.doc, function() {});
        });
    };

    this.commitRename = function(event) {
        var _self = this;
        var oldId = event.data.oldId;
        var newName = event.data.newName;
        var isGeneric = event.data.isGeneric;
        var commited = false;
        
        if (oldId.value === newName)
          return this.sender.emit("commitRenameResult", {});

        asyncForEach(this.handlers, function(handler, next) {
            if (_self.isHandlerMatch(handler, null, "commitRename")) {
                handler.commitRename(_self.doc, oldId, newName, isGeneric, function(response) {
                    if (response) {
                        commited = true;
                        _self.sender.emit("commitRenameResult", { err: response, oldName: oldId.value, newName: newName });
                        // only one handler gets to do this; don't call next();
                    } else {
                        next();
                    }
                });
            }
            else
                next();
            },
            function() {
                if (!commited)
                    _self.sender.emit("commitRenameResult", {});
            }
        );
    };

    this.onRenameCancel = function(event) {
        var _self = this;
        asyncForEach(this.handlers, function(handler, next) {
            if (_self.isHandlerMatch(handler, null, "onRenameCancel")) {
                handler.onRenameCancel(function() {
                    next();
                });
            }
            else {
                next();
            }
        });
    };

    var updateRunning;
    var updateWatchDog;
    this.onUpdate = function(now) {
        var _self = this;
        
        if (updateRunning) {
            // Busy. Try again after last job finishes.
            this.updateAgain = { now: now || this.updateAgain && this.updateAgain.now };
            return;
        }
        
        if (this.updateScheduled && !now) {
            // Already scheduled
            return;
        }
        
        // Cleanup
        this.updateAgain = null;
        clearTimeout(updateWatchDog);
        clearTimeout(this.updateScheduled);
        this.updateScheduled = null;

        if (!DEBUG) {
            updateWatchDog = setTimeout(function() {
                _self.updateScheduled = updateRunning = null;
                console.error("Warning: worker analysis taking too long or failed to call back (" + this.$lastAnalyzer + "), rescheduling");
            }, UPDATE_TIMEOUT_MAX + this.lastUpdateTime);
        }
        
        if (now) {
            doUpdate(function() {
                // Schedule another analysis without the now
                // and minimalAnalysis options. Disregard updateAgain.
                _self.onUpdate();
            });
            return;
        }
        
        this.updateScheduled = setTimeout(function() {
            _self.updateScheduled = null;
            doUpdate(function() {
                if (_self.updateAgain)
                    _self.onUpdate(_self.updateAgain.now);
            });
        }, UPDATE_TIMEOUT_MIN + Math.min(this.lastUpdateTime, UPDATE_TIMEOUT_MAX));
        
        function doUpdate(done) {
            updateRunning = true;
            var startTime = new Date().getTime();
            _self.asyncForEachHandler(
                { method: "onUpdate" },
                function(handler, next) {
                    var t = startTime();
                    handler.onUpdate(_self.doc, function() {
                        endTime(t, "Update: " + handler.$source);
                        next();
                    });
                },
                function() {
                    _self.analyze(now, function() {
                        if (_self.postponedCursorMove) {
                            _self.onCursorMoveAnalyzed(_self.postponedCursorMove);
                            _self.postponedCursorMove = null;
                        }
                        _self.lastUpdateTime = DEBUG ? 0 : new Date().getTime() - startTime;
                        clearTimeout(updateWatchDog);
                        updateRunning = false;
                        done && done();
                    });
                }
            );
        }
    };
    
    this.$documentToString = function(document) {
        if (!document)
            return "";
        if (Array.isArray(document))
            return document.join("\n");
        if (typeof document == "string")
            return document;
        
        // Convert ArrayBuffer
        var array = [];
        for (var i = 0; i < document.byteLength; i++) {
            array.push(document[i]);
        }
        return array.join("\n");
    };

    this.switchFile = function(path, immediateWindow, language, document, pos, workspaceDir) {
        var _self = this;
        var oldPath = this.$path;
        var code = this.$documentToString(document);
        this.$workspaceDir = workspaceDir === "" ? "/" : workspaceDir;
        this.$path = path;
        this.$language = language;
        this.immediateWindow = immediateWindow;
        this.lastCurrentNode = null;
        this.lastCurrentPos = null;
        this.lastCurrentPosUnparsed = null;
        this.cachedAsts = null;
        this.setValue(code);
        this.lastUpdateTime = 0;
        asyncForEach(this.handlers, function(handler, next) {
            _self.$initHandler(handler, oldPath, false, next);
        }, function() {
            _self.onUpdate(true);
        });
    };

    this.$initHandler = function(handler, oldPath, onDocumentOpen, callback) {
        var _self = this;
        handler.path = this.$path;
        handler.language = this.$language;
        handler.workspaceDir = this.$workspaceDir;
        handler.doc = this.doc;
        handler.sender = this.sender;
        handler.completeUpdate = this.completeUpdate.bind(this);
        handler.immediateWindow = this.immediateWindow;
        handler.$getIdentifierRegex = this.getIdentifierRegex.bind(this);
        this.initRegexes(handler, this.$language);
        if (!handler.$isInited) {
            handler.$isInited = true;
            handler.init(function() {
                // Note: may not return for a while for asynchronous workers,
                //       don't use this for queueing other tasks
                handler.onDocumentOpen(_self.$path, _self.doc, oldPath, function() {});
                handler.$isInitCompleted = true;
                callback();
            });
        }
        else if (onDocumentOpen) {
            // Note: may not return for a while for asynchronous workers,
            //       don't use this for queueing other tasks
            handler.onDocumentOpen(_self.$path, _self.doc, oldPath, function() {});
            callback();
        }
        else {
            callback();
        }
    };
    
    this.initAllRegexes = function(language) {
        if (this.$initedRegexes[language])
            return;
        this.$initedRegexes[language] = true;
        var that = this;
        this.handlers.forEach(function(h) {
            that.initRegexes(h, language);
        });
    };
    
    this.initRegexes = function(handler, language) {
        if (!handler.handlesLanguage(language))
            return;
        if (handler.getIdentifierRegex())
            this.sender.emit("setIdentifierRegex", { language: language, identifierRegex: handler.getIdentifierRegex() });
        if (handler.getCompletionRegex())
            this.sender.emit("setCompletionRegex", { language: language, completionRegex: handler.getCompletionRegex() });
        if (handler.getTooltipRegex())
            this.sender.emit("setTooltipRegex", { language: language, tooltipRegex: handler.getTooltipRegex() });
    };

    this.documentOpen = function(path, immediateWindow, language, document) {
        this.$openDocuments["_" + path] = path;
        var _self = this;
        var code = this.$documentToString(document);
        var doc = {getValue: function() {return code;} };
        asyncForEach(this.handlers, function(handler, next) {
            handler.onDocumentOpen(path, doc, _self.path, next);
        });
    };
    
    this.documentClose = function(event) {
        var path = event.data;
        delete this.$openDocuments["_" + path];
        asyncForEach(this.handlers, function(handler, next) {
            handler.onDocumentClose(path, next);
        });
    };

    // For code completion
    function removeDuplicateMatches(matches) {
        // First sort
        matches.sort(function(a, b) {
            if (a.name < b.name)
                return -1;
            else if (a.name > b.name)
                return 1;
            else
                return 0;
        });
        for (var i = 0; i < matches.length - 1; i++) {
            var a = matches[i];
            var b = matches[i + 1];
            if (a.name === b.name || (a.id || a.name) === (b.id || b.name)) {
                // Duplicate!
                if (a.priority < b.priority)
                    matches.splice(i, 1);
                else if (a.priority > b.priority)
                    matches.splice(i+1, 1);
                else if (a.score < b.score)
                    matches.splice(i, 1);
                else if (a.score > b.score)
                    matches.splice(i+1, 1);
                else
                    matches.splice(i, 1);
                i--;
            }
        }
    }

    this.complete = function(event) {
        var _self = this;
        var data = event.data;
        var pos = data.pos;
        var line = _self.doc.getLine(pos.row);
        
        _self.waitForCompletionSync(event, function onCompletionSync(identifierRegex) {
            var part = syntaxDetector.getContextSyntaxPart(_self.doc, pos, _self.$language);
            if (!part)
                return; // cursor position not current
            var partPos = syntaxDetector.posToRegion(part.region, pos);
            var language = part.language;
            var tStart = startTime();
            _self.parse(part, function(ast) {
                endTime(tStart, "Complete: parser");
                _self.findNode(ast, pos, function(node) {
                    var currentNode = node;
                    var matches = [];
    
                    asyncForEach(_self.handlers, function(handler, next) {
                        if (_self.isHandlerMatch(handler, part, "complete")) {
                            handler.language = language;
                            handler.workspaceDir = _self.$workspaceDir;
                            handler.path = _self.$path;
                            var t = startTime();
                            handler.complete(part, ast, partPos, currentNode, function(completions) {
                                endTime(t, "Complete: " + handler.$source.replace("plugins/", ""), 1);
                                if (completions && completions.length)
                                    matches = matches.concat(completions);
                                next();
                            });
                        }
                        else {
                            next();
                        }
                    }, function() {
                        removeDuplicateMatches(matches);
                        
                        // Always prefer current identifier (similar to complete.js)
                        var prefixLine = line.substr(0, pos.column);
                        matches.forEach(function(m) {
                            if (m.isGeneric && m.$source !== "local")
                                return;
                            var match = prefixLine.lastIndexOf(m.replaceText);
                            if (match > -1
                                && match === pos.column - m.replaceText.length
                                && completeUtil.retrievePrecedingIdentifier(line, pos.column, m.identifierRegex || identifierRegex))
                                m.priority = 99;
                        });
                        
                        // Sort by priority, score
                        matches.sort(function(a, b) {
                            if (a.priority < b.priority)
                                return 1;
                            else if (a.priority > b.priority)
                                return -1;
                            else if (a.score < b.score)
                                return 1;
                            else if (a.score > b.score)
                                return -1;
                            else if (a.id && a.id === b.id) {
                                if (a.isFunction)
                                    return -1;
                                else if (b.isFunction)
                                    return 1;
                            }
                            if (a.name < b.name)
                                return -1;
                            else if (a.name > b.name)
                                return 1;
                            else
                                return 0;
                        });
                        _self.sender.emit("complete", {
                            pos: pos,
                            matches: matches,
                            isUpdate: event.data.isUpdate,
                            line: line,
                            path: _self.$path,
                            forceBox: event.data.forceBox,
                            deleteSuffix: event.data.deleteSuffix
                        });
                        endTime(tStart, "COMPLETED!");
                    });
                });
            });
        });
    };
    
    /**
     * Check if the worker-side copy of the document is still up to date.
     * If needed, wait a little while for any pending change events
     * if needed (these should normally come in just before the complete event)
     */
    this.waitForCompletionSync = function(event, runCompletion) {
        var _self = this;
        var data = event.data;
        var pos = data.pos;
        var line = _self.doc.getLine(pos.row);
        this.waitForCompletionSyncThread = this.waitForCompletionSyncThread || 0;
        var threadId = ++this.waitForCompletionSyncThread;
        var regex = this.getIdentifierRegex(pos);
        if (!completeUtil.canCompleteForChangedLine(line, data.line, pos, pos, regex)) {
            setTimeout(function() {
                if (threadId !== _self.waitForCompletionSyncThread)
                    return;
                line = _self.doc.getLine(pos.row);
                if (!completeUtil.canCompleteForChangedLine(line, data.line, pos, pos, regex)) {
                    setTimeout(function() {
                        if (threadId !== _self.waitForCompletionSyncThread)
                            return;
                        if (!completeUtil.canCompleteForChangedLine(line, data.line, pos, pos, regex)) {
                            if (!line) { // sanity check
                                console.log("worker: seeing an empty line in my copy of the document, won't complete");
                            }
                            return; // ugh give up already
                        }
                        runCompletion(regex);
                    }, 20);
                }
                runCompletion(regex);
            }, 5);
            return;
        }
        runCompletion(regex);
    };
    
    /**
     * Retrigger completion if the popup is still open and new
     * information is now available.
     */
    this.completeUpdate = function(pos, line) {
        assert(line !== undefined);
        if (!isInWebWorker) { // Avoid making the stack too deep in ?noworker=1 mode
            var _self = this;
            setTimeout(function onCompleteUpdate() {
                _self.complete({data: {pos: pos, line: line, isUpdate: true}});
            }, 0);
        }
        else {
            this.complete({data: {pos: pos, line: line, isUpdate: true, forceBox: true}});
        }
    };
    
    function reportError(exception) {
        setTimeout(function() {
            throw exception; // throw bare exception so it gets reported
        });
    }

}).call(LanguageWorker.prototype);

});
