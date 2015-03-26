define(function(require, exports, module) {
    main.consumes = [
        "Panel", "settings", "ui", "immediate", "run", "panels", "tabManager", 
        "commands", "dialog.confirm", "dialog.error", "debugger.socket"
    ];
    main.provides = ["debugger"];
    return main;

    function main(options, imports, register) {
        var Panel = imports.Panel;
        var Socket = imports["debugger.socket"];
        var settings = imports.settings;
        var ui = imports.ui;
        var tabs = imports.tabManager;
        var panels = imports.panels;
        var commands = imports.commands;
        var run = imports.run;
        var showError = imports["dialog.error"].show;
        var confirm = imports["dialog.confirm"].show;
        
        var markup = require("text!./debugger.xml");
        var css = require("text!./debugger.css");
        
        /***** Initialization *****/
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 100,
            caption: "Debugger",
            className: "debugger",
            elementName: "winDebugger",
            minWidth: 165,
            width: 300,
            where: options.where || "right"
        });
        var emit = plugin.getEmitter();
        
        var debuggers = {};
        var pauseOnBreaks = 0;
        var state = "disconnected";
        var sources = [];
        var running, activeFrame, dbg, name, process, socket;
        
        var container, btnResume, btnStepOver, btnStepInto, btnStepOut, 
            btnSuspend, btnPause, btnOutput, btnImmediate; // ui elements
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            settings.on("read", function(){
                settings.setDefaults("user/debug", [
                    ["pause", "0"],
                    ["autoshow", "true"]
                ]);
                
                pauseOnBreaks = settings.getNumber("user/debug/@pause");
                togglePause(pauseOnBreaks);
            });
            
            // Register this panel on the left-side panels
            plugin.setCommand({
                name: "toggledebugger",
                hint: "show the debugger panel",
                // bindKey      : { mac: "Command-U", win: "Ctrl-U" }
            });
            
            // Commands
            
            commands.addCommand({
                name: "resume",
                group: "Run & Debug",
                hint: "resume the current paused process",
                bindKey: {mac: "F8", win: "F8"},
                exec: function(){
                    dbg && dbg.resume();
                }
            }, plugin);
            commands.addCommand({
                name: "suspend",
                group: "Run & Debug",
                hint: "suspend the current running process",
                // bindKey : {mac: "F8", win: "F8"},
                exec: function(){
                    dbg && dbg.suspend();
                }
            }, plugin);
            commands.addCommand({
                name: "stepinto",
                group: "Run & Debug",
                hint: "step into the function that is next on the execution stack",
                bindKey: {mac: "F11", win: "F11"},
                exec: function(){
                    dbg && dbg.stepInto()
                }
            }, plugin);
            commands.addCommand({
                name: "stepover",
                group: "Run & Debug",
                hint: "step over the current expression on the execution stack",
                bindKey: {mac: "F10", win: "F10"},
                exec: function(){
                    dbg && dbg.stepOver();
                }
            }, plugin);
            commands.addCommand({
                name: "stepout",
                group: "Run & Debug",
                hint: "step out of the current function scope",
                bindKey: {mac: "Shift-F11", win: "Shift-F11"},
                exec: function(){
                    dbg && dbg.stepOut();
                }
            }, plugin);
            
            // Load CSS
            ui.insertCss(css, plugin);
        }
        
        var drawn;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            // Import Skin
            ui.insertSkin({
                name: "debugger",
                data: require("text!./skin.xml"),
                "media-path" : options.staticPrefix + "/images/",
                "icon-path"  : options.staticPrefix + "/icons/"
            }, plugin);
            
            // Create UI elements
            var bar = opts.aml.appendChild(new ui.bar({
                "id"    : "winDebugger",
                "skin"  : "panel-bar",
                "class" : "debugcontainer"
            }));
            plugin.addElement(bar);
            
            var scroller = bar.$ext.appendChild(document.createElement("div"));
            scroller.className = "scroller";
            
            // Create UI elements
            var parent = bar;
            ui.insertMarkup(parent, markup, plugin);
            
            container = plugin.getElement("hbox");
            
            btnResume = plugin.getElement("btnResume");
            btnStepOver = plugin.getElement("btnStepOver");
            btnStepInto = plugin.getElement("btnStepInto");
            btnStepOut = plugin.getElement("btnStepOut");
            btnSuspend = plugin.getElement("btnSuspend");
            btnPause = plugin.getElement("btnPause");
            btnOutput = plugin.getElement("btnOutput");
            btnImmediate = plugin.getElement("btnImmediate");
            
            // @todo move this to F8 and toggle between resume
            // btnSuspend.on("click", function(){
            //     suspend();
            // });
            
            if (dbg)
                btnPause.setAttribute("disabled", !dbg.features.setBreakBehavior);
            
            btnPause.on("click", function(){
                togglePause();
            });
            
            btnOutput.on("click", function(){
                commands.exec("showoutput", null, {
                    id: name
                });
            });
            
            btnImmediate.on("click", function(){
                commands.exec("showimmediate", null, {
                    evaluator: "debugger"
                });
            });
            
            // Update button state
            plugin.on("stateChange", function(e) {
                state = e.state;
                
                updateButtonState(state);
            }, plugin);
            
            updateButtonState(state);
            
            emit.sticky("drawPanels", { html: scroller, aml: bar });
        }
        
        /***** Methods *****/
        
        function updateButtonState(state) {
            if (!drawn)
                return;
            
            var notConnected = state == "disconnected" || state == "away";
            
            btnResume.$ext.style.display = state == "stopped" 
                ? "inline-block" : "none";
            btnSuspend.$ext.style.display = notConnected 
                || state != "stopped" ? "inline-block" : "none";
                
            btnSuspend.setAttribute("disabled",  notConnected);
            btnStepOver.setAttribute("disabled", notConnected || state != "stopped");
            btnStepInto.setAttribute("disabled", notConnected || state != "stopped");
            btnStepOut.setAttribute("disabled",  notConnected || state != "stopped");
            btnOutput.setAttribute("disabled",  notConnected);
        }
        
        function initializeDebugger(){
            // State Change
            var stateTimer;
            dbg.on("stateChange", function(e) {
                var action = e.state == "running" ? "disable" : "enable";
                
                // Wait for 500ms in case we are step debugging
                clearTimeout(stateTimer);
                if (action == "disable")
                    stateTimer = setTimeout(function(){
                        updatePanels(action, e.state);
                    }, 500);
                else {
                    updatePanels(action, e.state);
                }
            }, plugin);
            
            // Receive the breakpoints on attach
            dbg.on("attach", function(e) {
                e.implementation = dbg;
                togglePause(pauseOnBreaks);
                
                if (btnPause)
                    btnPause.setAttribute("disabled", !dbg.features.setBreakBehavior);
                
                emit("attach", e);
            }, plugin);
            
            dbg.on("detach", function(e) {
                updateButtonState("detached");
                
                //@todo
                emit("detach", e);
            }, plugin);
            
            dbg.on("error", function(err) {
                if (err.code == "ECONNREFUSED") {
                    // Ignore error if process has stopped
                    if (process.running >= process.STARTING)
                        showError("Could not connect debugger to the debugger proxy");
                }
                else
                    showError(err.message);
            });
            
            dbg.on("getBreakpoints", function(){
                return emit("getBreakpoints");
            });
            
            // When hitting a breakpoint or exception or stepping
            function startDebugging(e) {
                if (settings.getBool("user/debug/@autoshow"))
                    panels.activate("debugger");
                
                // Reload Frames
                emit("framesLoad", e);
                
                // Process Exception
                if (e.exception) {
                    emit("exception", e);
                    // @todo add this into the ace view?
                }
                
                emit("break", e);
            }
            dbg.on("break", startDebugging, plugin);
            dbg.on("exception", startDebugging, plugin);
            dbg.on("suspend", function(){
                dbg.getFrames(function(err, frames) {
                    if (frames.length) {
                        startDebugging({
                            frames: frames,
                            frame: frames[0]
                        });
                    }
                });
            }, plugin);
            
            // When a new frame becomes active
            dbg.on("frameActivate", function(e) {
                activeFrame = e.frame;
                emit("frameActivate", e);
            }, plugin);
            
            dbg.on("sources", function(e) {
                sources = e.sources.slice()
                emit("sources", e);
            }, plugin);
            
            dbg.on("sourcesCompile", function(e) {
                sources.push(e.source);
                emit("sourcesCompile", e);
            }, plugin);
            
            dbg.on("breakpointUpdate", function(e) {
                emit("breakpointUpdate", {
                    breakpoint: e.breakpoint
                });
            }, plugin);
        }
        
        function updatePanels(action, runstate) {
            state = running != run.STOPPED && dbg && dbg.attached ? runstate : "disconnected";
            emit("stateChange", { state: state, action: action });
        }
        
        function togglePause(force) {
            pauseOnBreaks = force !== undefined
                ? force
                : (pauseOnBreaks > 1 ? 0 : pauseOnBreaks + 1);

            if (btnPause) {
                btnPause.setAttribute("class", "pause" + pauseOnBreaks + " nosize exception_break");
                btnPause.setAttribute("tooltip", 
                    pauseOnBreaks === 0
                        ? "Don't pause on exceptions"
                        : (pauseOnBreaks == 1
                            ? "Pause on all exceptions"
                            : "Pause on uncaught exceptions")
                );
            }
            
            if (state !== "disconnected" || force && dbg) {
                dbg.setBreakBehavior(
                    pauseOnBreaks === 1 ? "all" : "uncaught",
                    pauseOnBreaks === 0 ? false : true
                );
            }
            
            pauseOnBreaks = pauseOnBreaks;
            settings.set("user/debug/@pause", pauseOnBreaks);
        }
        
        function registerDebugger(type, debug) {
            debuggers[type] = debug;
        }
        
        function unregisterDebugger(type, debug) {
            if (debuggers[type] == debug)
                delete debuggers[type];
        }
        
        function showDebugFrame(frame, callback) {
            openFile({
                scriptId: frame.sourceId,
                line: frame.line - 1,
                column: frame.column,
                text: frame.name,
                path: frame.path
            }, callback);
        }
    
        function showDebugFile(script, row, column, callback) {
            openFile({
                scriptId: script.id,
                line: row, 
                column: column
            }, callback);
        }
    
        function openFile(options, callback) {
            var row = options.line + 1;
            var column = options.column;
            var path = options.path;
            var scriptId = options.script ? options.script.id : options.scriptId;
            var source;
            
            if (options.source)
                source = options.source;
            
            sources.every(function(src) {
                if (scriptId && src.id == scriptId) {
                    path = src.path;
                    source = src;
                    return false;
                }
                if (path && src.path == path) {
                    scriptId = src.scriptId;
                    source = src;
                    return false;
                }
                return true;
            });
            
            if (!source)
                source = { id : scriptId };
            
            var state = {
                path: path,
                active: true,
                value: source.debug ? -1 : undefined,
                document: {
                    title: path.substr(path.lastIndexOf("/") + 1),
                    meta: {
                        ignoreState: source.debug ? 1 : 0
                    },
                    ace: {
                        scriptId: scriptId,
                        lineoffset: 0,
                        customSyntax: source.customSyntax
                    }
                }
            };
            if (typeof row == "number" && !isNaN(row)) {
                state.document.ace.jump = {
                    row: row,
                    column: column
                };
            }
            
            if (emit("beforeOpen", {
                source: source,
                state: state,
                generated: options.generated,
                callback: callback || function(){}
            }) === false)
                return;

            tabs.open(state, function(err, tab, done) {
                if (err)
                    return console.error(err);
                if (!done)
                    return;
                tabs.focusTab(tab);
                    
                // If we need to load the contents ourselves, lets.
                dbg.getSource(source, function(err, value) {
                    if (err) return;
                    
                    tab.document.value = value;
                    
                    var jump = state.document.ace.jump;
                    if (tab.isActive() && jump) {
                        tab.document.editor
                          .scrollTo(jump.row, jump.column, jump.select);
                    }
                                    
                    done();
                    callback && callback(null, tab);
                });
                
                tab.document.getSession().readOnly = true;
            });
        }
        
        function debug(p, reconnect, callback) {
            var err;
            
            if (reconnect && process == p && dbg.connected) {
                return; // We're already connecting / connected
            }
            
            process = p;
            
            if (typeof reconnect == "function") {
                callback = reconnect;
                reconnect = null;
            }
            
            var runner = process.runner;
            if (runner instanceof Array)
                runner = runner[runner.length - 1];
            
            // Only update debugger implementation if switching or not yet set
            if (!dbg || dbg != debuggers[runner["debugger"]]) {
                
                // Currently only supporting one debugger at a time
                if (dbg) {
                    // Detach from runner
                    dbg.detach();
                    
                    // Unload the socket
                    socket.unload();
                    
                    // Remove all the set events
                    plugin.cleanUp(true);
                }
                
                // Find the new debugger
                dbg = debuggers[runner["debugger"]];
                if (!dbg) {
                    err = new Error(runner["debugger"]
                        ? "Unable to find a debugger with type " + runner["debugger"]
                        : "No debugger type specified in runner");
                    err.code = "EDEBUGGERNOTFOUND";
                    return callback(err);
                }
                
                // Attach all events necessary
                initializeDebugger();
            }
            
            if (process.running == process.STARTED)
                running = process.STARTED;
            else {
                process.on("started", function(){
                    running = run.STARTED;
                }, plugin);
            }
            
            if (!process.meta.$debugger) {
                process.on("away", function(){
                    updatePanels("disable", "away");
                });
                
                process.on("back", function(){
                    updatePanels("enable", dbg.state);
                    // debug(process, true, function(){});
                });
                
                process.on("stopped", function(){
                    running = run.STOPPED;
                    stop();
                }, plugin);
                
                process.meta.$debugger = true;
            }
            
            name = process.name;
            
            // Hook for plugins to delay or cancel debugger attaching
            // Whoever cancels is responible for calling the callback
            if (emit("beforeAttach", {
                runner: runner, 
                callback: callback
            }) === false)
                return;
            
            // Create the socket
            socket = new Socket(runner.debugport, dbg.getProxySource(process), reconnect);
            
            // Attach the debugger to the running process
            dbg.attach(socket, reconnect, callback);
        }
        
        function stop(){
            if (!dbg) return;
            
            // Detach from runner
            dbg && dbg.detach();
            
            // Unload the socket
            socket.unload();
            
            updatePanels("disable", "disconnected");
            
            if (settings.getBool("user/debug/@autoshow"))
                panels.deactivate("debugger");
        }
        
        function checkAttached(callback) {
            if (state != "disconnected") {
                confirm("The debugger is already connected to another process.",
                    "Would you like to stop the existing process?",
                    "Click OK to stop the existing process and start the new "
                    + "process with the debugger attached. Click Cancel to "
                    + " prevent starting the new process.",
                    function(){ // Confirm
                        process.stop(function(){
                            callback();
                        });
                    },
                    function(){ // Cancel
                        // Do Nothing
                    });
            }
            else {
                callback();
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Generic Debugger for Cloud9. This plugin is responsible for 
         * binding the different debug panels to a debugger implementation.
         * 
         * The default debug panels are:
         * 
         * * {@link breakpoints}
         * * {@link callstack}
         * * {@link variables}
         * * {@link watches}
         * 
         * You can create your own debug panel using the {@link DebugPanel}
         * base class.
         * 
         * #### Remarks
         * 
         * * The debugger also works together with the {@link immediate Immediate Panel}.
         * * If you want to create a debugger for your platform, check out the
         * {@link debugger.implementation} reference specification.
         * * The debugger implementation is choosen based on configuration
         * variables in the runner. See {@link #debug} and {@link run#run} for
         * more information on runners.
         * 
         * The following example shows how to start a debugger and 
         * programmatically work with breakpoints and breaks:
         * 
         *     // Start a process by executing example.js with the 
         *     // default runner for that extension (Node.js)
         *     var process = run.run("auto", {
         *         path  : "/example.js",
         *         debug : true
         *     }, function(err, pid) {
         *     
         *         // When a breakpoint is hit, ask if the user wants to break.
         *         debug.on("break", function(){
         *             if (!confirm("Would you like to break here?"))
         *                 debug.resume();
         *         });
         *         
         *         // Set a breakpoint on the first line of example.js
         *         debug.setBreakpoint({
         *             path       : "/example.js",
         *             line       : 0,
         *             column     : 0,
         *             enabled    : true
         *         });
         *         
         *         // Attach a debugger to the running process
         *         debug.debug(process.runner, function(err) {
         *             if (err) throw err.message;
         *         });
         *     });
         *
         * @singleton
         * @extends Panel
         */
        plugin.freezePublicAPI({
            /**
             * When the debugger has hit a breakpoint or an exception, it breaks
             * and shows the active frame in the callstack panel. The active
             * frame represents the scope at which the debugger is stopped.
             * @property {debugger.Frame} activeFrame
             */
            get activeFrame(){ return activeFrame; },
            set activeFrame(frame) { 
                activeFrame = frame; 
                emit("frameActivate", { frame: frame });
            },
            /**
             * The state of the debugger
             * @property {"running"|"stopped"|"disconnected"} sources
             * @readonly
             */
            get state(){ return state; },
            /**
             * A list of sources that are available from the debugger. These
             * can be files that are loaded in the runtime as well as code that
             * is injected by a script or by the runtime itself.
             * @property {debugger.Source[]} sources
             * @readonly
             */
            get sources(){ return sources; },
            /**
             * Retrieves if the debugger will break on exceptions
             * @property {Boolean} breakOnExceptions
             * @readonly
             */
            get breakOnExceptions(){ return dbg.breakOnExceptions; },
            /**
             * Retrieves whether the debugger will break on uncaught exceptions
             * @property {Boolean} breakOnUncaughtExceptions
             * @readonly
             */
            get breakOnUncaughtExceptions(){ return dbg.breakOnUncaughtExceptions; },
            
            _events: [
                /**
                 * Fires prior to a debugger attaching to a process.
                 * 
                 * This event serves as a hook for plugins to delay or 
                 * cancel a debugger attaching. Whoever cancels is responible 
                 * for calling the callback.
                 * 
                 * @event beforeAttach
                 * @cancellable
                 * @param {Object}   e
                 * @param {Object}   e.runner    The object that is running the process. See {@link #debug}.
                 * @param {Function} e.callback  The callback with which {@link #debug} was called.
                 */
                "beforeAttach",
                /**
                 * Fires when the debugger has attached itself to the process.
                 * @event attach
                 * @param {Object}                  e
                 * @param {debugger.Breakpoint[]}   e.breakpoints     The breakpoints that are currently set.
                 * @param {debugger.implementation} e.implementation  The used debugger implementation
                 */
                "attach",
                /**
                 * Fires when the debugger has detached itself from the process.
                 * @event detach
                 */
                "detach",
                /**
                 * Fires when the callstack frames have loaded for current 
                 * frame that the debugger is breaked at.
                 * @event framesLoad
                 * @param {Object}           e
                 * @param {debugger.Frame[]} e.frames  The frames of the callstack.
                 */
                "framesLoad",
                /**
                 * Fires when the debugger hits a breakpoint or an exception.
                 * @event break
                 * @param {Object}           e
                 * @param {debugger.Frame}   e.frame        The frame where the debugger has breaked at.
                 * @param {debugger.Frame[]} [e.frames]     The callstack frames.
                 * @param {Error}            [e.exception]  The exception that the debugger breaked at.
                 */
                "break",
                /**
                 * Fires prior to opening a file from the debugger.
                 * @event beforeOpen
                 * @cancellable
                 * @param {Object}          e
                 * @param {debugger.Source} e.source     The source file to open.
                 * @param {Object}          e.state      The state object that is passed to the {@link tabManager#method-open} method.
                 * @param {Boolean}         e.generated  Specifies whether the file is a generated file.
                 */
                "beforeOpen",
                /**
                 * Fires when a file is opened from the debugger.
                 * @event open
                 * @cancellable
                 * @param {Object}          e
                 * @param {debugger.Source} e.source      The source file to open.
                 * @param {String}          e.path        The path of the source file to open
                 * @param {String}          e.value       The value of the source file.
                 * @param {Function}        e.done        Call this function if you are cancelling the event.
                 * @param {Function}        e.done.value  The value of the source file
                 * @param {Tab}             e.tab         The created tab for the source file.
                 */
                "open",
                /**
                 * Fires when the panels are being drawn.
                 * @event drawPanels
                 * @param {Object}      e       
                 * @param {HTMLElement} e.html  The html container for the panel.
                 * @param {AMLElement}  e.aml   The aml container for the panel.
                 * @private
                 */
                "drawPanels",
                /**
                 * Fires when the state of the debugger changes.
                 * @event stateChange
                 * @param {Object} e
                 * @param {"disconnected"|"running"|"stopped"} e.state  The state of the debugger.
                 * <table>
                 * <tr><td>Value</td><td>           Description</td></tr>
                 * <tr><td>"disconnected"</td><td>  Not connected to a process</td></tr>
                 * <tr><td>"stopped"</td><td>       paused on breakpoint</td></tr>
                 * <tr><td>"running"</td><td>       process is running</td></tr>
                 * </table>
                 */
                "stateChange",
                /**
                 * Fires when the active frame changes. See also {@link #activeFrame}.
                 * @event frameActivate
                 * @param {Object}         e
                 * @param {debugger.Frame} e.frame  The frame that is currently active.
                 */
                "frameActivate",
                /**
                 * Fires when a new list of sources comes in from the debugger.
                 * @event sources
                 * @param {Object}            e
                 * @param {debugger.Source[]} e.sources  The list of sources
                 */
                "sources",
                /**
                 * Fires when a new source file is compiled.
                 * @event sourcesCompile
                 * @param {Object}          e
                 * @param {debugger.Source} e.source  The compiled source file.
                 */
                "sourcesCompile",
                /**
                 * Fires when a breakpoint is updated (for instance with location info).
                 * @event breakpointUpdate
                 * @param {Object}              e
                 * @param {debugger.Breakpoint} e.breakpoint  The breakpoint that is updated.
                 */
                "breakpointUpdate",
                /**
                 * Fires when the debugger needs a list of breakpoints.
                 * @event getBreakpoints
                 * @private
                 */
                "getBreakpoints"
            ],
            
            /**
             * Attaches the debugger that is specified by the runner to the
             * running process that is started using the same runner.
             * 
             * *N.B.: There can only be one debugger attached at the same time.*
             * 
             * @param {run.Process} process        The process that will be debugger.
             * @param {Boolean}     [reconnect]    Specifies whether the debugger should reconnect to an existing debug session.
             * @param {Function}    callback       Called when the debugger is attached.
             * @param {Error}       callback.err   Error object with information on an error if one occured.
             */
            debug: debug,
            
            /**
             * Detaches the started debugger from it's process.
             */
            stop: stop,
            
            /**
             * Registers a {@link debugger.implementation debugger implementation}
             * with a unique name. This name is used as the "debugger" property
             * of the runner.
             * @param {String}                  name      The unique name of this debugger implementation.
             * @param {debugger.implementation} debugger  The debugger implementation.
             */
            registerDebugger: registerDebugger,
            
            /**
             * Unregisters a {@link debugger.implementation debugger implementation}.
             * @param {String}                  name      The unique name of this debugger implementation.
             * @param {debugger.implementation} debugger  The debugger implementation.
             */
            unregisterDebugger: unregisterDebugger,
            
            /**
             * Continues execution of a process after it has hit a breakpoint.
             */
            resume: function(){ dbg.resume() },
            
            /**
             * Pauses the execution of a process at the next statement.
             */
            suspend: function(){ dbg.suspend() },
            
            /**
             * Step into the next statement.
             */
            stepInto: function(){ dbg.stepInto() },
            
            /**
             * Step out of the current statement.
             */
            stepOut: function(){ dbg.stepOut() },
            
            /**
             * Step over the next statement.
             */
            stepOver: function(){ dbg.stepOver() },
            
            /**
             * Retrieves the contents of a source file from the debugger (not 
             * the file system).
             * @param {debugger.Source} source         The source file.
             * @param {Function}        callback       Called when the contents is retrieved.
             * @param {Function}        callback.err   Error object if an error occured.
             * @param {Function}        callback.data  The contents of the file.
             */
            getSource: function(source, callback) { 
                dbg.getSource(source, callback);
            },
            
            /**
             * Defines how the debugger deals with exceptions.
             * @param {"all"/"uncaught"} type          Specifies which errors to break on.
             * @param {Boolean}          enabled       Specifies whether to enable breaking on exceptions.
             * @param {Function}         callback      Called after the setting is changed.
             * @param {Error}            callback.err  The error if any error occured.
             */
            setBreakBehavior: function(type, enabled, callback) { 
                // dbg.setBreakBehavior(type, enabled, callback); 
                togglePause(enabled ? (type == "uncaught" ? 1 : 2) : 0);
            },
            
            /**
             * Evaluates an expression in a frame or in global space.
             * @param {String}            expression         The expression.
             * @param {debugger.Frame}    frame              The stack frame which serves as the context of the expression.
             * @param {Boolean}           global             Specifies whether to execute the expression in global space.
             * @param {Boolean}           disableBreak       Specifies whether to disabled breaking when executing this expression.
             * @param {Function}          callback           Called after the expression has executed.
             * @param {Error}             callback.err       The error if any error occured.
             * @param {debugger.Variable} callback.variable  The result of the expression.
             */
            evaluate: function(expression, frame, global, disableBreak, callback) { 
                dbg.evaluate(expression, frame, global, disableBreak, callback); 
            },
            
            /**
             * Check whether a debugger is already attached. If the debugger is
             * already attached it will present a dialog to the user asking 
             * how to handle the situation.
             * @param {Function} callback  Called when the user chooses to run
             * the new process.
             */
            checkAttached: checkAttached,
            
            /**
             * Displays a frame in the ace editor.
             * @param {debugger.Frame} frame  The frame to display
             */
            showDebugFrame: showDebugFrame,
            
            /**
             * Displays a debugger source file in the ace editor
             * @param {debugger.Source} script  The source file to display
             * @param {Number}          row     The row (zero bound) to scroll to.
             * @param {Number}          column  The column (zero bound) to scroll to.
             */
            showDebugFile: showDebugFile,
            
            /**
             * Opens a file from disk or from the debugger.
             * @param {Number}          [row]         The row (zero bound) to scroll to.
             * @param {Number}          [column]      The column (zero bound) to scroll to.
             * @param {String}          [path]        The path of the file to open
             * @param {debugger.Source} [script]      The source file to open
             * @param {String}          [scriptId]    The script id of the file to open
             * @param {Boolean}         [generated]   
             */
            openFile: openFile
        });
        
        register(null, {
            "debugger": plugin
        });
    }
});