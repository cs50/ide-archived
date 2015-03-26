define(function(require, exports, module) {
    main.consumes = [
        "c9", "Plugin", "editors", "dialog.error",
        "terminal.monitor.message_view", "tabManager", "error_handler",
        "proc"
    ];
    main.provides = ["terminal.monitor"];
    return main;

    function main(options, imports, register) {
        var BASHBIN = options.bashBin ||  "/bin/bash";
        
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var editors = imports.editors;
        var messageView = imports["terminal.monitor.message_view"];
        var tabManager = imports.tabManager;
        var errorHandler = imports.error_handler;
        var proc = imports.proc;
        
        var MessageHandler = require("./message_handler");
        var messageMatchers = require("./message_matchers")(c9);
        var _ = require('lodash');
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var messageHandler = new MessageHandler(messageMatchers.matchers, messageView);
        
        messageView.on("action", function(cmd, message) {
            proc.execFile(BASHBIN, {
                args: ["--login", "-c", cmd]
            }, function() {
                messageHandler.hide(message);
            });
        })
        
        editors.on("create", function(e) {
            if (!e.editor || e.editor.type !== "terminal") // && e.editor.type !== "output")
                return;
            
            e.editor.on("documentLoad", function(e) {
                setupTerminalMessageHandler(e.doc.getSession());
            });
        });
        
        function setupTerminalMessageHandler(session) {
            var terminal = session.terminal;
            var seenUpTo = 0;
            var hasResizeCompleted = false;
            
            function handleMessage(message) {
                var tab = session.tab;
                if (tab.isActive() && tabManager.focussedTab === tab) {
                    messageHandler.handleMessage(message, tab);
                }
            }
            
            terminal.on("newline", function(e) {
                var y = e.y;
                var linesIndex = y + e.ybase - 1;
                
                if (!_.isArray(e.lines[linesIndex])) {
                    errorHandler.reportError(new Error("Can not access line item in lines array"), {
                        y: e.y,
                        ybase: e.ybase,
                        linesCnt: e.lines ? e.lines.length : undefined
                    }, ["terminal.monitor"]);
                    return;
                }
                
                var line = e.lines[linesIndex].map(function(character) {
                    return character && character[1];
                }).join("");
                
                if (!hasResizeCompleted) {
                    if (line.length) {
                        seenUpTo = e.y;
                    }
                    return;
                }
                
                // There are cases where newline doesn't fire for a "rendered" newline.
                // Making sure that we check lines when we encounter these gaps.
                while (seenUpTo < y) {
                    seenUpTo++;
                    var tmpLinesIndex = seenUpTo + e.ybase - 1;
                    var tmpLine = e.lines[tmpLinesIndex].map(function(character) {
                        return character && character[1];
                    }).join("");
                    handleMessage(tmpLine);
                }

                if (y - 1 > seenUpTo) return;
                seenUpTo = y;
                
                handleMessage(line);
            });
            
            var resizeTimeout;
            terminal.on("resizeStart", function() {
                hasResizeCompleted = false;
                if (resizeTimeout) {
                    clearTimeout(resizeTimeout);
                }
                
                messageHandler.reposition(session.tab);
                
                resizeTimeout = setTimeout(function() {
                    resizeTimeout = null;
                    hasResizeCompleted = true;
                }, 1000);
            });
        }
        
        plugin.freezePublicAPI({});
        
        /***** Register and define API *****/
        register(null, {
            "terminal.monitor": plugin
        });
    }
});
