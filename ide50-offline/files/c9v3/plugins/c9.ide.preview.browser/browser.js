define(function(require, exports, module) {
    main.consumes = [
        "Previewer", "preview", "vfs", "tabManager", "remote.PostMessage", "c9",
        "CSSDocument", "HTMLDocument", "JSDocument", "MenuItem", "commands"
    ];
    main.provides = ["preview.browser"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Previewer = imports.Previewer;
        var tabManager = imports.tabManager;
        var preview = imports.preview;
        var PostMessage = imports["remote.PostMessage"];
        var CSSDocument = imports.CSSDocument;
        var HTMLDocument = imports.HTMLDocument;
        var JSDocument = imports.JSDocument;
        var MenuItem = imports.MenuItem;
        var commands = imports.commands;
        
        // var join = require("path").join;
        // var dirname = require("path").dirname;
        
        /***** Initialization *****/
        
        var plugin = new Previewer("Ajax.org", main.consumes, {
            caption: "Browser",
            index: 10,
            divider: true,
            selector: function(path) {
                return /(?:\.html|\.htm|\.xhtml)$|^https?\:\/\//.test(path);
            }
        });
        
        var BASEPATH = preview.previewUrl;
        var counter = 0;
        
        /***** Methods *****/
        
        function calcRootedPath(url) {
            if (url.substr(0, BASEPATH.length) == BASEPATH)
                return url.substr(BASEPATH.length);
            return url;
        }
        
        function getIframeSrc(iframe){
            var src;
            try{ src = iframe.contentWindow.location.href; }
            catch(e){ src = iframe.src }
            return src;
        }
        
        function cleanIframeSrc(src) {
            return src
                .replace(/_c9_id=\w+\&_c9_host=.*?(?:\&|$)/, "")
                .replace(/[\?\&]$/, "");
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            commands.addCommand({
                name: "scrollPreviewElementIntoView",
                displayName: "Preview:scroll element into view",
                bindKey: {win: "Ctrl-I", mac: "Ctrl-I"},
                exec: function(editor) {
                    if (editor.type == "preview")
                        plugin.activeSession.transport.reveal();
                    else
                        editor.ace.session.htmldocument.scrollIntoView();
                },
                isAvailable: function(editor) {
                    return editor 
                        && (editor.ace && editor.ace.session.htmldocument
                        || editor.type == "preview");
                }
            }, plugin);
            
            var item = new MenuItem({
                caption: "Enable Highlighting", 
                type: "check",
                onclick: function(){
                    var session = plugin.activeSession;
                    (session.transport || 0).enableHighlighting = item.checked;
                },
                isAvailable: function(){
                    item.checked = ((plugin.activeSession || 0).transport || 0).enableHighlighting;
                    return true;
                }
            });
            preview.settingsMenu.append(item);
            
            var item2 = new MenuItem({
                caption: "Disable Live Preview Injection", 
                type: "check",
                onclick: function(){
                    var session = plugin.activeSession || 0;
                    session.disableInjection = item2.checked;
                    plugin.navigate({ url: session.path });
                },
                isAvailable: function(){
                    item2.checked = (plugin.activeSession || 0).disableInjection;
                    return true;
                }
            })
            preview.settingsMenu.append(item2);
            
            preview.settingsMenu.append(new MenuItem({ 
                caption: "Scroll Preview Element Into View", 
                command: "scrollPreviewElementIntoView"
            }));
        });
        
        plugin.on("documentLoad", function(e) {
            var doc = e.doc;
            var session = doc.getSession();
            var tab = doc.tab;
            var editor = e.editor;
            
            if (session.iframe) {
                session.editor = editor;
                editor.container.appendChild(session.iframe);
                return;
            }
            
            var iframe = document.createElement("iframe");
            iframe.setAttribute("nwfaketop", true);
            iframe.setAttribute("nwdisable", true);
            
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = 0;
            iframe.style.backgroundColor = "rgba(255, 255, 255, 0.88)";
            
            iframe.addEventListener("load", function(){
                if (!iframe.src) return;
                
                var src = getIframeSrc(iframe);
                var path = calcRootedPath(cleanIframeSrc(src));
                
                tab.title = 
                tab.tooltip = "[B] " + path;
                session.lastSrc = src;
                
                if (options.local) {
                    var url = cleanIframeSrc(getIframeSrc(iframe));
                    if (url.indexOf("data:") === 0) {
                        editor.setLocation(path);
                    }
                    else {
                        editor.setLocation(url);
                        session.currentLocation = url;
                    }
                    
                    iframe.contentWindow.opener = window;
                    if (iframe.contentWindow.start)
                        iframe.contentWindow.start(window);
                }
                else {
                    editor.setLocation(path);
                }
                
                tab.classList.remove("loading");
            });
            
            session.id = "livepreview" + counter++;
            session.iframe = iframe;
            session.editor = editor;
            session.transport = new PostMessage(iframe, session.id);
            
            session.transport.on("ready", function(){
                session.transport.getSources(function(err, sources) {
                    session.styleSheets = sources.styleSheets.map(function(path) {
                        return new CSSDocument(path).addTransport(session.transport);
                    });
                    session.scripts = sources.scripts.map(function(path) {
                        return new JSDocument(path).addTransport(session.transport);
                    });
                    session.html = new HTMLDocument(sources.html)
                        .addTransport(session.transport);
                });
            }, doc);
            session.transport.on("focus", function(){
                tabManager.focusTab(doc.tab);
            }, doc);
            
            session.destroy = function(){
                if (session.transport)
                    session.transport.unload();
                delete session.editor;
                delete session.transport;
                delete session.iframe;
                delete session.id;
            };
            
            // Lets only destroy when the doc is destroyed
            doc.addOther(function(){ session.destroy() });
            
            doc.on("canUnload", function(e) {
                if (!session.transport) return;
                
                var count = session.transport.getWindows().length;
                if (count <= 1) return true;
                
                session.transport.once("empty", function(){
                    doc.unload();
                });
                
                return false;
            }, session);
            
            editor.container.appendChild(session.iframe);
        });
        plugin.on("documentUnload", function(e) {
            var doc = e.doc;
            var session = doc.getSession();
            var iframe = session.iframe;
            
            iframe.parentNode.removeChild(iframe);
            
            doc.tab.classList.remove("loading");
        });
        plugin.on("documentActivate", function(e) {
            var session = e.doc.getSession();
            var path = calcRootedPath(cleanIframeSrc(getIframeSrc(session.iframe)));
            
            session.iframe.style.display = "block";
            session.editor.setLocation(path, true);
            session.editor.setButtonStyle("Browser", "page_white.png");
        });
        plugin.on("documentDeactivate", function(e) {
            var session = e.doc.getSession();
            session.iframe.style.display = "none";
        });
        plugin.on("navigate", function(e) {
            var tab = plugin.activeDocument.tab;
            var session = plugin.activeSession;
            var iframe = session.iframe;
            if (!iframe) // happens when save is called from collab see also previewer naviagate
                return;
            var nurl = e.url.replace(/^~/, c9.home);
            var url = nurl.match(/^[a-z]\w{1,4}\:\/\//)
                ? nurl
                : BASEPATH + nurl;
            
            var base = (session.url || "").split("#")[0];
            if (url.indexOf(base + "#") == -1 && url != base)
                tab.classList.add("loading");
            session.url = url;
            
            if (session.disableInjection) {
                iframe.src = url;
            }
            else {
                var parts = url.split("#");
                iframe.src = parts[0] + (~parts[0].indexOf("?") ? "&" : "?")
                    + "_c9_id=" + session.id
                    + "&_c9_host=" + (options.local ? "local" : location.origin)
                    + (parts.length > 1 ? "#" + parts[1] : "");
            }
            
            var path = calcRootedPath(url);
            tab.title = 
            tab.tooltip = "[B] " + path;
            
            plugin.activeSession.editor.setLocation(path, true);
        });
        plugin.on("update", function(e) {
            // var iframe = plugin.activeSession.iframe;
            // if (e.saved)
            //     iframe.src = iframe.src;
        });
        plugin.on("reload", function(){
            var iframe = plugin.activeSession.iframe;
            var tab = plugin.activeDocument.tab;
            tab.classList.add("loading");
            var src = getIframeSrc(iframe);
            // if (src.match(/(.*)#/))
            //     src = RegExp.$1;
            iframe.src = src;
        });
        plugin.on("popout", function(){
            var src = getIframeSrc(plugin.activeSession.iframe);
            window.open(src);
        });
        plugin.on("getState", function(e) {
            var session = e.doc.getSession();
            var state = e.state;
            
            state.currentLocation = session.currentLocation;
            state.disableInjection = session.disableInjection;
        });
        plugin.on("setState", function(e) {
            var session = e.doc.getSession();
            var state = e.state;
            
            if (state.currentLocation) {
                if (session.initPath)
                    session.initPath = state.currentLocation;
                // else
                //     plugin.navigate({ url: state.currentLocation, doc: e.doc });
            }
            session.disableInjection = state.disableInjection;
        });
        plugin.on("unload", function(){
        });
        
        /***** Register and define API *****/
        
        /**
         * Previewer for content that the browser can display natively.
         **/
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            "preview.browser": plugin
        });
    }
});