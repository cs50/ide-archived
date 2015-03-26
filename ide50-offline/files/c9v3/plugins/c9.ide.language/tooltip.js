/**
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "tabManager", "language", "ui", "ace", "util"
    ];
    main.provides = ["language.tooltip"];
    return main;
    
    function main(options, imports, register) {
        var language = imports.language;
        var tabs = imports.tabManager;
        var dom = require("ace/lib/dom");
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var aceHandle = imports.ace;
        var tree = require("treehugger/tree");
        var assert = require("c9/assert");
        var SyntaxDetector = require("./syntax_detector");
        var util = imports.util;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var ace, languageWorker, isVisible, labelHeight, adjustCompleterTop;
        var isTopdown, tooltipEl, allowImmediateEmit, lastPos;
        var cursormoveTimeout, onMouseDownTimeout;
        var tooltipRegexes = {};
        var lastCompletionTooltip = {};
        
        function load() {
            console.log(language)
            tooltipEl = dom.createElement("div");
            tooltipEl.className = "language_tooltip dark";
            
            language.getWorker(function(err, worker) {
                languageWorker = worker;
                worker.on("hint", function(event) {
                    var tab = tabs.focussedTab;
                    if (!tab || tab.path !== event.data.path)
                        return;
                    
                    assert(tab.editor && tab.editor.ace, "Could find a tab but no editor for " + event.data.path);
                    onHint(event, tab.editor.ace);
                });
                worker.on("tooltipRegex", function(event) {
                    tooltipRegexes[event.data.language] = event.data.tooltipRegex;
                });
                language.on("cursormove", function(e) {
                    clearTimeout(cursormoveTimeout);
                    if (e.selection.rangeCount || !e.selection.isEmpty() || !tabs.focussedTab)
                        return hide();
                    if (lastPos && !inRange(lastPos, e.pos)) {
                        // Just walked outside of tooltip range
                        if (lastPos.sl !== e.pos.row)
                            hide();
                        if (allowImmediateEmit) {
                            allowImmediateEmit = false;
                            return setTimeout(function() { // send after any change event
                                worker.emit("cursormove", { data: { pos: e.pos, line: e.doc.getLine(e.pos.row) }});
                            }, 0);
                        }
                    }
                    applyLastCompletionTooltip();
                    cursormoveTimeout = setTimeout(function() {
                        var latestPos = e.doc.selection.getCursor();
                        worker.emit("cursormove", { data: { pos: latestPos, line: e.doc.getLine(latestPos.row), now: e.now }});
                        cursormoveTimeout = null;
                    }, e.now ? 0 : 100);
                });
            });
            
            aceHandle.on("themeChange", function(e) {
                var theme = e.theme;
                if (!theme) return;
                
                tooltipEl.className = "language_tooltip " 
                    + (theme.isDark ? "dark" : "");
            }, plugin);
        }
        
        plugin.on("load", function() {
            load();
        });

        plugin.on("unload", function() {
            if (tooltipEl && tooltipEl.parentNode)
                tooltipEl.parentNode.removeChild(tooltipEl);
        });
    
        function onHint(event, ace) {
            var message = event.data.message;
            var pos = event.data.pos;
            var cursorPos = ace.getCursorPosition();
            var line = ace.getSession().getDocument().getLine(cursorPos.row);

            if (message && message.signatures) {
                message = message.signatures.map(function(sig) {
                    var activeParam;
                    var doc = sig.name + "("
                        + sig.parameters.map(function(p) {
                            if (p.active)
                                activeParam = p;
                            return p.active
                                ? '<span class="language_activeparam">'
                                    + util.escapeXml(p.name)
                                    + "</span>"
                                : '<span class="language_param">' + util.escapeXml(p.name) + "</span>";
                        }).join(", ")
                        + ")";
                    if (sig.returnType)
                        doc += " : " + util.escapeXml(sig.returnType);
                    if (activeParam && activeParam.type) {
                         doc += '&nbsp;&mdash; <span class="language_type">'
                            + util.escapeXml(activeParam.name)
                            + ':&nbsp;' + util.escapeXml(activeParam.type)
                            + "</span>";
                    }
                    if (activeParam && (activeParam.doc)) {
                        doc += '<div class="language_paramhelp">'
                            // + '<span class="language_activeparamindent">' + fnName + '(</span>'
                            + '<span class="language_activeparam">' + util.escapeXml(activeParam.name) + '</span>:'
                            + '<span class="language_activeparamhelp">' + util.escapeXml(activeParam.doc || activeParam.type) + '</span></div>';
                    }
                    return doc;
                }).join("<br />");
            }
            
            clearTimeout(onMouseDownTimeout);
            
            if (ace.selection.rangeCount || !ace.selection.isEmpty())
                return hide();
            
            if (line !== event.data.line) {
                // console.warn("Got outdated tooltip event from worker, retrying");
                if (!cursormoveTimeout)
                    cursormoveTimeout = setTimeout(function() {
                        language.onCursorChange();
                        cursormoveTimeout = null;
                    }, 50);
                if (lastPos && lastPos.sl !== cursorPos.row)
                    hide();
                return;
            }
            
            if (message && inRange(pos, cursorPos)) {
                var displayPos = event.data.displayPos || cursorPos;
                show(displayPos.row, displayPos.column, message, ace);
                lastPos = pos;
                allowImmediateEmit = true;
                lastCompletionTooltip.active = false;
            }
            else if (!(lastPos && inRange(lastPos, cursorPos))) {
                if (!lastCompletionTooltip.active)
                    hide();
            }
        }
        
        function inRange(pos, cursorPos) {
            // We only consider the cursor in range if it's on the first row
            // of the tooltip area
            return pos.sl === cursorPos.row && tree.inRange(pos, { line: cursorPos.row, col: cursorPos.column });
        } 
        
        var drawn = false;
        function draw() {
            if (drawn) return true;
            drawn = true;
            
            ui.insertCss(require("text!./complete.css"), plugin);
        }
        
        function show(row, column, html, _ace) {
            draw();
            ace = _ace;
            
            if (!isVisible) {
                isVisible = true;
                
                window.document.body.appendChild(tooltipEl);
                ace.on("mousewheel", hide);
                tabs.on("focus", hide);
                window.document.addEventListener("mousedown", onMouseDown);
            }
            tooltipEl.innerHTML = html;
            //setTimeout(function() {
                var position = ace.renderer.textToScreenCoordinates(row, column);
                var cursorConfig = ace.renderer.$cursorLayer.config;
                labelHeight = dom.getInnerHeight(tooltipEl);
                isTopdown = true;
                if (position.pageY < labelHeight)
                    isTopdown = true;
                else if (position.pageY + labelHeight > window.innerHeight)
                    isTopdown = false;
                tooltipEl.style.left = (position.pageX - 22) + "px";
                if (!isTopdown)
                    tooltipEl.style.top = (position.pageY - labelHeight + 3) + "px";
                else
                    tooltipEl.style.top = (position.pageY + cursorConfig.lineHeight + 2) + "px";
                adjustCompleterTop && adjustCompleterTop(labelHeight);
            //});
        }
        
        function onMouseDown() {
            clearTimeout(onMouseDownTimeout);
            onMouseDownTimeout = setTimeout(hide, 300);
        }
        
        function getHeight() {
            return isVisible && labelHeight || 0;
        }
        
        function isTopdown() {
            return isTopdown;
        }
        
        function getRight() {
            return isVisible && tooltipEl.getBoundingClientRect().right;
        }
            
        function hide(clearLastPos) {
            if (clearLastPos)
                lastPos = null;
            if (isVisible) {
                try {
                    tooltipEl.parentElement.removeChild(tooltipEl);
                } catch (e) {
                    console.error(e);
                }
                window.document.removeEventListener("mousedown", onMouseDown);
                ace.off("mousewheel", hide);
                isVisible = false;
            }
        }
        
        function getTooltipRegex(language, ace) {
            return tooltipRegexes[language || getSyntax(ace)];
        }
        
        function getSyntax(ace) {
            return ace && SyntaxDetector.getContextSyntax(
                ace.session.doc,
                ace.getCursorPosition(),
                ace.session.syntax);
        }
        
        function setLastCompletion(completion, pos) {
            // Here we store information about generic completions
            // that may be usable as tooltips
            if (!completion.isGeneric || !completion)
                return lastCompletionTooltip = {};
            var simpleName = completion.replaceText.replace("^^", "").replace(/\(\)$/, "");
            if (simpleName === completion.name || completion.name.indexOf(simpleName) !== 0)
                return lastCompletionTooltip = {};
            
            var matcher = "(" + util.escapeRegExp(simpleName) + ")\\(([^\\)]*)?";
            lastCompletionTooltip = {
                doc: completion.name,
                row: pos.row,
                matcher: new RegExp(matcher + "$"),
                substringMatcher: new RegExp(matcher),
                tab: tabs.focussedTab
            };
        }
        
        function applyLastCompletionTooltip() {
            var tab = tabs.focussedTab;
            var ace = tab && tab.editor && tab.editor.ace;
            if (!ace || lastCompletionTooltip.tab !== tab)
                return;
            var pos = ace.getCursorPosition();
            var line = ace.getSession().getDocument().getLine(pos.row).substr(0, pos.column);
            if (!line.match(lastCompletionTooltip.matcher))
                return lastCompletionTooltip.active ? hide() : null;
            
            var name = RegExp.$1;
            var args = RegExp.$2;
            var beforeMatch = line.substr(0, line.length - name.length - args.length);
            var doc = beautifyCompletionDoc(args);
            show(pos.row, beforeMatch.length, doc, ace);
            lastPos = null;
            lastCompletionTooltip.active = true;
        }
        
        function beautifyCompletionDoc(args) {
            var doc = lastCompletionTooltip.doc;
            if (!doc.match(lastCompletionTooltip.substringMatcher))
                return doc;
            var argIndex = args.split(",").length - 1;
            return doc.replace(
                lastCompletionTooltip.substringMatcher,
                function(all, name, params) {
                    return name + "(" + (params || "").split(",").map(function(param, i) {
                        return i === argIndex
                            ? '<span class="language_activeparam">' + param + '</span>'
                            : param;
                    });
                }
            );
        }
        
        plugin.freezePublicAPI({
            hide: hide,
            show: show,
            getHeight: getHeight,
            getRight: getRight,
            isTopdown: isTopdown,
            set adjustCompleterTop(f) {
                adjustCompleterTop = f;
            },
            getTooltipRegex: getTooltipRegex,
            setLastCompletion: setLastCompletion
        });
        
        /**
         * @internal
         */
        register(null, {
            "language.tooltip": plugin
        });
    }
    
});
