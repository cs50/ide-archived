/**
 * node debugger Module for the Cloud9
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

//https://coderwall.com/p/hkmedw?utm_campaign=weekly_digest&utm_content=2013-04-02+00%3A00%3A00+UTC&utm_medium=email
//https://github.com/johnjbarton/chrome.debugger.remote
//https://github.com/cyrus-and/chrome-remote-interface
//https://github.com/danielconnor/node-devtools/tree/master/lib

//https://github.com/cyrus-and/chrome-remote-interface
//https://developers.google.com/chrome-developer-tools/docs/protocol/1.0/debugger#event-paused
//https://github.com/google/crx2app/issues/1
//https://github.com/google/devtoolsExtended

define(function(require, exports, module) {
    main.consumes = ["Plugin", "c9", "debugger", "net"];
    main.provides = ["chromedebugger"];
    return main;
    
    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var net = imports.net;
        var debug = imports["debugger"];
        
        var Frame = require("../../data/frame");
        var Source = require("../../data/source");
        var Breakpoint = require("../../data/breakpoint");
        var Variable = require("../../data/variable");
        var Scope = require("../../data/scope");
        
        var V8Debugger = require("./lib/V8Debugger");
        var V8DebuggerService = require("./lib/StandaloneV8DebuggerService");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var stripPrefix = (options.basePath || "");
        var breakOnExceptions = false;
        var breakOnUncaughtExceptions = false;
        
        var v8dbg, v8ds, state, activeFrame, sources;
        
        var scopeTypes = {
            "0" : "global",
            "1" : "local",
            "2" : "with",
            "3" : "function",
            "4" : "catch"
        }
        
        plugin.__defineGetter__("breakOnExceptions", function(){ 
            return breakOnExceptions;
        });
        plugin.__defineGetter__("breakOnUncaughtExceptions", function(){ 
            return breakOnUncaughtExceptions;
        });
        
        var hasChildren = {
            "object"   : 8,
            "function" : 4
        }
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            debug.registerDebugger("v8", plugin);
        }
        
        function unload(){
            debug.unregisterDebugger("v8", plugin);
            loaded = false;
        }
        
        /***** Helper Functions *****/
        
        /**
         * Syncs the debug state to the client
         */
        function sync(breakpoints, callback) {
            getSources(function(err, sources) {
                getFrames(function(err, frames) {
                    updateBreakpoints(breakpoints, function(err, breakpoints) {
                        handleDebugBreak(breakpoints, function() {
                            emit("attach", { breakpoints: breakpoints });
                            
                            if (activeFrame) {
                                onChangeFrame(activeFrame);
                                emit("break", {
                                    frame: activeFrame,
                                    frames: frames
                                });
                            }
                            onChangeRunning();
                            
                            callback();
                        });
                    });
                }, true); // The sync backtrace should be silent
            });
        }
        
        function updateBreakpoints(breakpoints, callback) {
            function find(bp) {
                for (var i = 0, l = breakpoints.length; i < l; i++) {
                    if (breakpoints[i].equals(bp))
                        return breakpoints[i];
                }
            }
            
            var list = breakpoints.slice(0);
            
            listBreakpoints(function(err, remoteBreakpoints) {
                if (err) return callback(err);
                
                var found = [];
                var notfound = [];
                
                remoteBreakpoints.forEach(function(rbp) {
                    var bp;
                    if ((bp = find(rbp)))
                        found.push(bp);
                    else
                        notfound.push(rbp);
                });
                
                list.forEach(function(bp) {
                    if (found.indexOf(bp) == -1)
                        setBreakpoint(bp);
                });
                
                notfound.forEach(function(bp) { 
                    bp.serverOnly = true;
                    list.push(bp);
                });
                
                list.sort(function(a, b) {
                    if (!a.id && !b.id) return 0;
                    if (!a.id && b.id) return 1;
                    if (a.id && !b.id) return -1;
                    return a.id - b.id;
                });
                
                callback(null, list);
            })
        }
        
        /**
         * Detects a break on a frame or a known breakpoint, otherwise resumes
         */
        function handleDebugBreak(breakpoints, callback) {
            var frame = activeFrame;
            if (!v8dbg) { //!frame || 
                console.warn("NO DBG");
                return callback();
            }
            
            var bp = breakpoints[0];
            
            // If there's no breakpoint set
            if (!bp)
                return resume(callback);
            
            // Check for a serverOnly breakpoint on line 0
            // this bp, is automatically created by v8 to stop on break
            if (bp.id === 1 && bp.serverOnly && bp.line === 0) {
                // The breakpoint did it's job, now lets remove it
                v8dbg.clearbreakpoint(1, function(){});
                breakpoints.remove(bp);
            }
            
            // Check if there is a real breakpoint here, so we don't resume
            function checkEval(err, variable) {
                if (err || isTruthy(variable)) {
                    onChangeFrame(null);
                    resume(callback);
                }
                else {
                    callback();
                }
            }
            
            // @todo this is probably a timing issue
            if (frame) {
                var test = {path: frame.path, line: 0};
                for (var bpi, i = 0, l = breakpoints.length; i < l; i++) {
                    if ((bpi = breakpoints[i]).equals(test)) {
                        // If it's not enabled let's continue
                        if (!bpi.enabled)
                            break;
                          
                        // Check a condition if it has it
                        if (bpi.condition) {
                            evaluate(bpi.condition, frame, false, true, checkEval);
                        }
                        else {
                            callback();
                        }
                        return;
                    }
                }
            }
            
            // Resume the process
            onChangeFrame(null);
            resume(callback);
        }
        
        /**
         * Removes the path prefix from a string
         */
        function strip(str) {
            return str.lastIndexOf(stripPrefix, 0) === 0
                ? str.slice(stripPrefix.length)
                : str;
        }
    
        /**
         * Returns the unique id of a frame
         */
        function getFrameId(frame) {
            return frame.func.name + ":" + frame.func.inferredName 
                + ":" + frame.func.scriptId + ":" 
                + (frame.received && frame.received.ref || "")
                + frame.arguments.map(function(a){return a.value.ref}).join("-");
                
            //return (frame.func.name || frame.func.inferredName || (frame.line + frame.position));
        }
    
        function formatType(value) {
            switch (value.type) {
                case "undefined":
                case "null":
                    return value.type;
    
                case "boolean":
                case "number":
                    return value.value + "";
                    
                case "string":
                    return JSON.stringify(value.value);
    
                case "object":
                    return "[" + (value.className || "Object") + "]";
    
                case "function":
                    return "function " + value.inferredName + "()";
    
                default:
                    return value.type;
            }
        }
        
        function isTruthy(variable) {
            if ("undefined|null".indexOf(variable.type) > -1)
                return false;
            if ("false|NaN|\"\"".indexOf(variable.value) > -1)
                return false;
            return true;
        }
        
        function frameToString(frame) {
            var str = [];
            var args = frame.arguments;
            var argsStr = [];
    
            str.push(frame.func.name || frame.func.inferredName || "anonymous", "(");
            for (var i = 0, l = args.length; i < l; i++) {
                var arg = args[i];
                if (!arg.name)
                    continue;
                argsStr.push(arg.name);
            }
            str.push(argsStr.join(", "), ")");
            return str.join("");
        }
        
        function getPathFromScriptId(scriptId) {
            for (var i = 0; i < sources.length; i++) {
                if (sources[i].id == scriptId)
                    return sources[i].path;
            }
        };
        
        function getScriptIdFromPath(path) {
            for (var i = 0; i < sources.length; i++) {
                if (sources[i].path == path)
                    return sources[i].id;
            }
        }

        function getLocalScriptPath(script) {
            var scriptName = script.name || ("-anonymous-" + script.id);
            if (scriptName.substring(0, stripPrefix.length) == stripPrefix)
                scriptName = scriptName.substr(stripPrefix.length);
                
            // windows paths come here independantly from vfs
            return scriptName.replace(/\\/g, "/");
        }
        
        function createFrame(options, script) {
            var frame = new Frame({
                index: options.index,
                name: apf.escapeXML(frameToString(options)), //dual escape???
                column: options.column,
                id: getFrameId(options),
                line: options.line,
                script: strip(script.name),
                path: getLocalScriptPath(script),
                sourceId: options.func.scriptId
            });
            
            var vars = [];
            
            // Arguments
            options.arguments.forEach(function(arg) {
                vars.push(createVariable(arg, null, "arguments"));
            });
            
            // Local variables
            options.locals.forEach(function(local) {
                if (local.name !== ".arguments")
                    vars.push(createVariable(local, null, "locals"));
            });
            
            // Adding the local object as this
            vars.push(createVariable({
                name: "this",
                value: options.receiver,
                kind: "this"
            }));
            
            frame.variables = vars;
            
             /*
             0: Global
             1: Local
             2: With
             3: Closure
             4: Catch >,
                if (scope.type > 1) {*/
            
            frame.scopes = options.scopes.filter(function(scope) {
                return scope.type != 1;
            }).reverse().map(function(scope) {
                return new Scope({
                    index: scope.index,
                    type: scopeTypes[scope.type],
                    frameIndex: frame.index
                });
            });
            
            return frame;
        }
        
        function createVariable(options, name, scope) {
            return new Variable({
                name: name || options.name,
                scope: scope,
                value: formatType(options.value),
                type: options.value.type,
                ref: typeof options.value.ref == "number" 
                    ? options.value.ref 
                    : options.value.handle,
                children: hasChildren[options.value.type] ? true : false
            });
        }
        
        function createSource(options) {
            return new Source({
                id: options.id,
                name: options.name || "anonymous",
                path: getLocalScriptPath(options),
                text: strip(options.text || "anonymous"),
                debug: true,
                lineOffset: options.lineOffset
            });
        }
        
        function createBreakpoint(options, serverOnly) {
            return new Breakpoint({
                id: options.number,
                path: getPathFromScriptId(options.script_id),
                line: options.line,
                column: options.column,
                condition: options.condition,
                enabled: options.active,
                ignoreCount: options.ignoreCount,
                serverOnly: serverOnly || false
            });
        }
        
        /***** Event Handler *****/
    
        function onChangeRunning(e) {
            if (!v8dbg) {
                state = null;
            } else {
                state = v8dbg.isRunning() ? "running" : "stopped";
            }
    
            emit("stateChange", {state: state});
    
            if (state != "stopped")
                onChangeFrame(null);
        }
        
        function createFrameFromBreak(data) {
            // Create a frame from the even information
            return new Frame({
                index: 0,
                name: data.invocationText,
                column: data.sourceColumn,
                id: String(data.line) + ":" + String(data.sourceColumn),
                line: data.sourceLine,
                script: strip(data.script.name),
                path: getLocalScriptPath(data.script),
                sourceId: data.script.id
            });
        }
    
        function onBreak(e) {
            var bps = e.data && e.data.breakpoints;
            if (bps && bps.length === 1 && bps[0] === 1)
                return;
            
            // @todo update breakpoint text?
            
            var frame = createFrameFromBreak(e.data);
            emit("break", {
                frame: frame
            });
        }
    
        function onException(e) {
            var frame = createFrameFromBreak(e.data);
            
            emit("exception", {
                frame: frame, 
                exception: e.exception
            });
        }
    
        function onAfterCompile(e) {
            emit("sourcesCompile", {source: createSource(e.data.script)})
        }
    
        function onChangeFrame(frame, silent) {
            activeFrame = frame;
            if (!silent)
                emit("frameActivate", {frame: frame});
        }
    
        /***** Socket *****/
        
        function Socket(port) {
            var emit = this.getEmitter();
            var state, stream;
            
            this.__defineGetter__("state", function(){ return state; });
            
            function connect() {
                if (state) 
                    return;
                
                net.connect(port, {}, function(err, s) {
                    if (err) {
                        return emit("error", err);
                    }
                    
                    stream = s;
                    stream.on("data", function(data) {
                        emit("data", data);
                    });
                    stream.on("end", function(err) {
                        emit("end", err);
                    });
                    stream.on("error", function(err) {
                        emit("error", err);
                    });
                    
                    state = "connected";
                    emit("connect");
                });
                
                state = "connecting";
            };
        
            function close(err) {
                stream && stream.end();
                state = null;
                emit("end", err);
            };
        
            function send(msg) {
                stream.write(msg, "utf8");
            };

            // Backward compatibility
            this.addEventListener = this.on;
            this.removeListener = this.off;
            this.setMinReceiveSize = function(){};
            
            /**
             * 
             */
            this.connect = connect;
            
            /**
             * 
             */
            this.close = close;
            
            /**
             * 
             */
            this.send = send;
        };
        Socket.prototype = new Plugin();
        
        /***** Methods *****/
        
        function attach(runner, breakpoints, callback) {
            if (v8ds)
                v8ds.detach();
            
            v8ds = new V8DebuggerService(new Socket(runner.debugport));
            v8ds.attach(0, function(err) {
                if (err) return callback(err);

                v8dbg = new V8Debugger(0, v8ds);
                
                // register event listeners
                v8dbg.addEventListener("changeRunning", onChangeRunning);
                v8dbg.addEventListener("break", onBreak);
                v8dbg.addEventListener("exception", onException);
                v8dbg.addEventListener("afterCompile", onAfterCompile);
                
                onChangeFrame(null);
                sync(breakpoints, callback);
            });
        }
    
        function detach() {
            if (!v8ds)
                return;
            
            v8ds.detach();
            
            onChangeRunning();
            
            if (v8dbg) {
                // on detach remove all event listeners
                v8dbg.removeEventListener("changeRunning", onChangeRunning);
                v8dbg.removeEventListener("break", onBreak);
                v8dbg.removeEventListener("exception", onException);
                v8dbg.removeEventListener("afterCompile", onAfterCompile);
            }
            
            v8ds = null;
            v8dbg = null;
            
            emit("detach");
        }
        
        function getSources(callback) {
            v8dbg.scripts(4, null, false, function(scripts) {
                sources = [];
                for (var i = 0, l = scripts.length; i < l; i++) {
                    var script = scripts[i];
                    if ((script.name || "").indexOf("chrome-extension://") === 0)
                        continue;
                    sources.push(createSource(script));
                }
                callback(null, sources);
                
                emit("sources", {sources: sources})
            });
        }
        
        function getSource(source, callback) {
            v8dbg.scripts(4, [source.id], true, function(scripts) {
                if (!scripts.length)
                    return callback(new Error("File not found : " + source.path));

                callback(null, scripts[0].source);
            });
        }
        
        function getFrames(callback, silent) {
            v8dbg.backtrace(null, null, null, true, function(body, refs) {
                function ref(id) {
                    for (var i = 0; i < refs.length; i++) {
                        if (refs[i].handle == id) {
                            return refs[i];
                        }
                    }
                    return {};
                }
    
                var frames;
                if (body && body.totalFrames > 0) {
                    frames = body && body.frames.map(function(frame) {
                        return createFrame(frame, ref(frame.script.ref));
                    }) || [];
        
                    var topFrame = frames[0];
                    topFrame && (topFrame.istop = true);
                    onChangeFrame(topFrame, silent);
                }
                else {
                    frames = [];
                    onChangeFrame(null, silent);
                }
                
                emit("getFrames", {frames: frames});
                callback(null, frames);
            });
        }
        
        function getScope(frame, scope, callback) {
            v8dbg.scope(scope.index, frame.index, true, function(body) {
                var variables = body.object.properties.map(function(prop) {
                    return createVariable(prop);
                });
                
                scope.variables = variables;
                
                callback(null, variables, scope, frame);
            });
        }
        
        function getProperties(variable, callback) {
            v8dbg.lookup([variable.ref], false, function(body) {
                var props = body[variable.ref].properties || [];
                lookup(props, false, function(err, properties) {
                    variable.properties = properties;
                    callback(err, properties, variable);
                });
            });
        }
        
        function stepInto(callback) {
            v8dbg.continueScript("in", null, callback);
        }
        
        function stepOver(callback) {
            v8dbg.continueScript("next", null, callback);
        }
        
        function stepOut(callback) {
            v8dbg.continueScript("out", null, callback);
        }
    
        function resume(callback) {
            v8dbg.continueScript(null, null, callback);
        }
    
        function suspend(callback) {
            v8dbg.suspend(function(){
                emit("suspend");
                callback && callback();
            });
        }
    
        function lookup(props, includeSource, callback) {
            v8dbg.lookup(props.map(function(p){ return p.ref }), 
              includeSource, function(body) {
                if (!body)
                    return callback(new Error("No body received"));
                  
                var properties = props.map(function(prop) { 
                    prop.value = body[prop.ref];
                    return createVariable(prop);
                });
                
                callback(null, properties);
            });
        }
        
        function setScriptSource(scriptId, newSource, previewOnly, callback) {
            var NODE_PREFIX = "(function (exports, require, module, __filename, __dirname) { ";
            var NODE_POSTFIX = "\n});";
            newSource = NODE_PREFIX + newSource + NODE_POSTFIX;
            
            v8dbg.changelive(scriptId, newSource, previewOnly, function(e) {
                callback(e);
            });
        };
        
        function evaluate(expression, frame, global, disableBreak, callback) {
            v8dbg.evaluate(expression, frame, global, disableBreak, function(body, refs, error) {
                var name = expression.trim();
                if (error) {
                    var err = new Error(error.message);
                    err.name = name;
                    err.stack = error.stack;
                    return callback(err);
                }
                
                var variable = new Variable({
                    name: name,
                    value: formatType(body),
                    type: body.type,
                    ref: typeof body.ref == "number" 
                        ? body.ref 
                        : body.handle,
                    children: body.properties && body.properties.length ? true : false
                });
                
//              @todo - and make this consistent with getProperties
//                if (body.constructorFunction)
//                    value.contructor = body.constructorFunction.ref;
//                if (body.prototypeObject)
//                    value.prototype = body.prototypeObject.ref;
                
                if (variable.children) {
                    lookup(body.properties, false, function(err, properties) {
                        variable.properties = properties;
                        callback(null, variable);
                    });
                }
                else {
                    callback(null, variable);
                }
            });
        }
        
        function setBreakpoint(bp, callback) {
            var sm = bp.sourcemap || {};
            var path = sm.source || bp.path;
            var line = sm.line || bp.line;
            var column = sm.column || bp.column;
            var scriptId = getScriptIdFromPath(path);
            
            if (!scriptId) {
                // Wait until source is parsed
                plugin.on("sourcesCompile", function wait(e) {
                    if (e.source.path.indexOf(path)) {
                        plugin.off("sources.compile", wait);
                        setBreakpoint(bp, callback);
                    }
                });
                return false;
            }

            v8dbg.setbreakpoint("scriptId", scriptId, line, column, bp.enabled, 
                bp.condition, bp.ignoreCount, function(info) {
                    bp.id = info.breakpoint;
                    
                    if (info.actual_locations) {
                        bp.actual = info.actual_locations[0];
                        emit("breakpointUpdate", {breakpoint: bp});
                    }
                    callback && callback(bp, info);
                });
            
            return true;
        }
        
        function changeBreakpoint(bp, callback) {
            v8dbg.changebreakpoint(bp.id, bp.enabled, 
                bp.condition, bp.ignoreCount, function(info) {
                    callback && callback(bp, info);
                });
        }
        
        function clearBreakpoint(bp, callback) {
            v8dbg.clearbreakpoint(bp.id, callback)
        }
        
        function listBreakpoints(callback) {
            v8dbg.listbreakpoints(function(data) {
                breakOnExceptions = data.breakOnExceptions;
                breakOnUncaughtExceptions = data.breakOnUncaughtExceptions;
                
                callback(null, data.breakpoints.map(function(bp) {
                    return createBreakpoint(bp);
                }));
            });
        }
        
        function setVariable(variable, parents, value, frame, callback) {
            // Get variable name
            var names = [];
            parents.reverse().forEach(function(p) {
                // Assuming scopes are accessible
                if (p.tagName == "variable")
                    names.push(p.name.replace(/"/g, '\\"'));
            });
            names.push(variable.name);
            
            var name = names.shift() + (names.length
                ? '["' + names.join('"]["') + '"]'
                : "");
            
            // Define expression
            var expression = name + " = " + value + ";";
            
            // Execute expression to set variable
            evaluate(expression, frame, null, true, function(err, info) { 
                if (err)
                    return callback(err);
                
                variable.children = info.children == "true";
                variable.type = info.type;
                variable.ref = info.ref;
                variable.value = formatType(info);
                variable.properties = [];
                
                callback(err, info);
            })
        }
        
        function setBreakBehavior(type, enabled, callback) {
            breakOnExceptions = enabled ? type == "all" : false;
            breakOnUncaughtExceptions = enabled ? type == "uncaught" : false;
            
            v8dbg.setexceptionbreak(type, enabled, callback);
        }
    
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            unload();
        });
        
        /***** Register and define API *****/
        
        /**
         * V8 Debugger Plugin for Cloud9. This plugin is as stateless as
         * possible.
         * 
         * @property state {null|"running"|"stopped"} state of the debugged process
         *    null      process doesn't exist
         *   "stopped"  paused on breakpoint
         *   "running"
         * 
         * @event break Fires ...
         * @param {Object} e
         *     frame    {Object} description
         * @event stateChange Fires ...
         * @param {Object} e
         *     state    {null|"running"|"stopped"} description
         * @event exception Fires ...
         * @param {Object} e
         *     frame     {Object} descriptionn
         *     exception {Error} description
         * @event frameActivate Fires ...
         * @param {Object} e
         *     frame    {Object} description
         * @event getFrames Fires ...
         * @param {Object} e
         *     frames   {Array} description
         * @event sources Fires ...
         * @param {Object} e
         *     sources  {Array} description
         * @event sourcesCompile Fires when a source file is (re-)compiled.
         *   In your event handler, make sure you check against the sources you
         *   already have collected to see if you need to update or add your
         *   source.
         * @param {Object} e
         *     file     {Object} the file information (not the content)
         *       path       {String}
         *       text       {String}
         *       debug      {Boolean}
         *       scriptid   {Number}
         *       scriptname {String}
         *       lineoffset {Number}
         **/
        plugin.freezePublicAPI({
            /**
             * Attaches the debugger to the started debugee instance
             * @param runner The type of the running process
             * @param breakpoints The set of breakpoints that should be set from the start
             */
            attach: attach,
            
            /**
             * Detaches the debugger, clears the active frame data
             * and resets the debug UI
             */
            detach: detach,
            
            /**
             * Loads all the active sources from the debugee instance
             * 
             * scriptid: script.id,
                scriptname: script.name || "anonymous",
                path: getLocalScriptPath(script),
                text: strip(script.text || "anonymous"),
                lineoffset: script.lineOffset,
                debug: "true"
             */
            getSources: getSources,
            
            /**
             * Loads a specific source from the active sources in the debugee instance
             * @param source APF node to extract request attributes from
             */
            getSource: getSource,
            
            /**
             * Returns the debug stack trace representing the current state of the
             * debugger instance - mainly including the stack frames and references
             * to the frame source
             */
            getFrames: getFrames,
            
            /**
             * Loads a stack frame to the UI
             * @param frame the stack frame object to load
             */
            getScope: getScope,
            
            /**
             * Loads an object with its properties using its handle
             * @param item APF node for the object to load to extract the handle from
             */
            getProperties: getProperties,
            
            /**
             * 
             */
            stepInto: stepInto,
            
            /**
             * 
             */
            stepOver: stepOver,
            
            /**
             * 
             */
            stepOut: stepOut,
            
            /**
             * Continue instance execution after a suspend caused by
             * "break", "exception" events or "suspend" request
             * @param stepaction <"in", "next" or "out">
             * @param stepcount <number of steps (default 1)>
             */
            resume: resume,
            
            /**
             * Suspends execution of the debugee instance
             */
            suspend: suspend,
            
            /**
             * Lookup multiple generic objects using their handles
             * (can be VM objects or sources)
             * @param handles the array of handles to lookup for
             * @param includeSource boolean whether to include the source
             * when source objects are returned
             */
            lookup: lookup,
            
            /**
             * Evaluate an expression string in a specific frame
             * @param expression string
             * @param frame the stack frame object
             * @param global boolean
             * @param disableBreak boolean
             */
            evaluate: evaluate,
            
            /**
             * Change a live running source to the latest code state
             * @param sourceId the scriptid attribute of the target source
             * @param newSource string of the new source code
             * @param previewOnly boolean
             */
            setScriptSource: setScriptSource,
            
            /**
             * 
             */
            setBreakpoint: setBreakpoint,
            
            /**
             * 
             */
            changeBreakpoint: changeBreakpoint,
            
            /**
             * 
             */
            clearBreakpoint: clearBreakpoint,
            
            /**
             * 
             */
            listBreakpoints: listBreakpoints,
            
            /**
             * 
             */
            setVariable: setVariable,
            
            /**
             * 
             */
            setBreakBehavior: setBreakBehavior
        });
        
        register(null, {
            chromedebugger: plugin
        });
    }
});