/**
 * Code Editor for the Cloud9
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "Editor", "editors", "Document", "settings", "ui", "menus", 
        "tabManager", "Form", "util", "Menu", "MenuItem"
    ];
    main.provides = ["dashboard"];
    return main;
    
    function main(options, imports, register) {
        var Editor = imports.Editor;
        var Document = imports.Document;
        var Plugin = imports.Plugin;
        var editors = imports.editors;
        // var settings = imports.settings;
        var ui = imports.ui;
        var Form = imports.Form;
        var tabs = imports.tabManager;
        var util = imports.util;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        
        // Markup & Modes
        var cssString = require("text!./style.css");
        
        var uCaseFirst = require("c9/string").uCaseFirst;
        
        /***** Factory for a Dashboard type *****/
        
        var handle = new Plugin("Ajax.org", main.consumes);
        var handleEmit = handle.getEmitter();
        
        // Menu
        // var menuWidgets = menus.setRootMenu("Dashboard", 1, -1, new ui.menu({ 
        //     id: "mnuWidgets",
        //     "onprop.visible": function(e) {
        //         if (e.value)
        //             this.lastDashboard = this.opener.dashboard;
        //     }
        // }), handle);
            
        var menuInstall = new Menu({
            items: [
                new MenuItem({ caption: "New Relic Agent" }),
                new MenuItem({ caption: "StrongLoop Agent" }),
                new MenuItem({ caption: "Loggly" }),
                new MenuItem({ caption: "Google Analytics" })
            ]
        }, handle);
        
        var settingsPanel, model;
        function getSettingsPanel(){
            if (settingsPanel) return settingsPanel;
            
            // Create UI elements
            ui.insertMarkup(null, require("text!./dashboard.xml"), handle);
            
            settingsPanel = handle.getElement("panel");
            var level1 = handle.getElement("level1");
            var level2 = handle.getElement("level2");
            var preview = handle.getElement("preview");
            var pform = handle.getElement("form");
            
            model = new ui.model();
            
            var data = apf.getXml("<data />");
            Object.keys(providers).forEach(function(id) {
                var node = apf.n("<provider />")
                    .attr("name", providers[id].name)
                    .attr("logo", providers[id].logo)
                    .node();
                providers[id].widgets.forEach(function(id) {
                    var wnode = apf.n("<widget />")
                        .attr("name", widgets[id].caption)
                        .attr("value", id)
                        .node();
                    node.appendChild(wnode);
                });
                data.appendChild(node);
            });
            model.load(data);
            
            level1.setAttribute("model", model);
            level1.on("afterselect", function(e) {
                level2.setAttribute("model", e.selected);
                level2.show();
                preview.hide();
                pform.hide();
                
                settingsPanel.$ext.querySelector(".start").style.display = "block";
                settingsPanel.$ext.querySelector(".configure").style.display = "none";
            });
            
            var lastPreview;
            level2.on("afterselect", function(e) {
                var id = e.selected.getAttribute("value");
                var options = widgets[id];
    
                // Create Form
                var form = options.formElement || createForm(id);
                form.meta.dashboard = tabs.focussedTab.editor;
                
                if (pform.$int.firstChild)
                    pform.$int.removeChild(pform.$int.firstChild);
                form.attachTo(pform.$int);
                pform.show();
    
                // Create Preview Widget
                if (!options.preview) {
                    options.def.dashboard = {};
                    var widget = new Widget(options.def);
                    
                    var state = {};
                    state[widget.type] = util.extend(widget.state || {}, form.toJson());
                    state.value = state[widget.type].value;
                    
                    var doc = new Document(state);
                    doc.tab = widget; //Some plugins only know tab
                    doc.widget = widget;
                        
                    widget.on("editor", function(){
                        widget.editor.loadDocument(doc);
                    });
                    widget.on("beforeUnload", function(){
                        return false;
                    });
                    options.preview = widget;
                }
                else widget = options.preview;
                
                // Show Widget
                if (lastPreview)
                    lastPreview.aml.hide();
                preview.show();
                widget.attachTo(preview);
                widget.aml.show();
                lastPreview = widget;
                
                settingsPanel.$ext.querySelector(".start").style.display = "none";
                settingsPanel.$ext.querySelector(".configure").style.display = "block";
            });
            
            return settingsPanel;
        }
        
        function createForm(id) {
            var options = widgets[id];
            var form = options.formElement = options.form && options.form({}) || 
                new Form({
                    edge: "3 3 8 3",
                    rowheight: 35,
                    colwidth: 50,
                    style: "padding:10px;",
                });
                
            form.add([
                { type: "divider" },
                {
                    title: "Title",
                    name: "title",
                    type: "textbox",
                    skin: "searchbox"
                },
                {
                    type: "submit",
                    caption: "Update Preview",
                    "default" : true,
                    margin: "10 10 5 10",
                    onclick: function(){
                        var widget = options.preview;
                        var doc = widget.editor.activeDocument;
                        doc.unload();
                        
                        var state = {};
                        state[widget.type] = util.extend(widget.state || {}, form.toJson());
                        state.value = state[widget.type].value;
                        
                        doc = new Document(state);
                        doc.tab = widget; //Some plugins only know tab
                        doc.widget = widget;
                        widget.editor.loadDocument(doc);
                        
                        if (state[widget.type].title)
                            widget.title = state[widget.type].title;
                    }
                },
                { type: "divider" },
                {
                    type: "submit",
                    caption: "Add To Dashboard",
                    "default" : true,
                    margin: "10 10 5 10",
                    onclick: function(){
                        var widget = options.preview;
                        var state = util.extend(widget.state || {}, form.toJson())
                        state.id = id;
                        if (!state.title)
                            delete state.title;
                        
                        var dashboard = tabs.focussedTab.editor;
                        dashboard.addWidget(state);
                        
                        setTimeout(function(){
                            dashboard.getElement("btnCancel").dispatchEvent("click", {});
                        }, 500);
                    }
                }
            ]);
            
            return form;
        }
        
        // Widgets
        var widgets = {}, providers = {};
        function registerWidget(id, provider, caption, def, form) {
            // setSubMenu(parent, name, index, item, menu, plugin)
            // menus.setMenuItem(parent, name, menuItem, index, item, plugin)
            
            // var full = "Dashboard";
            // path.split("/").forEach(function(item) {
            //     full += "/" + item;
            //     if (full == "Dashboard/" + path) {
            //         menus.addItemByPath("Dashboard/" + path, new ui.item({
            //             value   : id,
            //             onclick : function(){
            //                 menuWidgets.lastDashboard.addWidget({id: id});
            //             }
            //         }), 100, handle);
            //     }
            //     else if (!menus.get(full).item) {
            //         menus.addItemByPath(full, new ui.item(), 100, handle);
            //         menus.addItemByPath(full + "/Install All", new ui.item({
            //             onclick: function(){
            //                 var ids = this.parentNode.childNodes
            //                     .slice(2).map(function(n){ return n.value })
            //                 var widget = menuWidgets.lastDashboard.addWidget({id: ids[0]}, null, true);
            //                 ids.slice(1).forEach(function(id) {
            //                     menuWidgets.lastDashboard.addWidget({id: id}, null, false, widget.aml);
            //                 })
            //             }
            //         }), 10, handle);
            //         menus.addItemByPath(full + "/~", new ui.divider(), 20, handle);
            //     }
            // })
            
            widgets[id] = { provider: provider, caption: caption, def: def, form: form };
            providers[provider].widgets.push(id);
        }
        
        function unregisterWidget(id) {
            delete widgets[id];
        }
        
        function registerProvider(options) {
            options.widgets = [];
            providers[options.name] = options;
        }
        
        function unregisterProvider(name) {
            for (var i = 0; i < providers.length; i++) {
                if (providers[i].name == name) {
                    providers.splice(i, 1);
                    break;
                }
            }
        }
        
        function findWidget(id) {
            return widgets[id];
        }
        
        handle.freezePublicAPI({
            /**
             * 
             */
            create: Factory,
            
            /**
             * 
             */
            registerProvider: registerProvider,
            
            /**
             * 
             */
            unregisterProvider: unregisterProvider,
            
            /**
             * 
             */
            register: registerWidget,
            
            /**
             * 
             */
            unregister: unregisterWidget
        });
        
        function vsplit(split, child, far) {
            return hsplit(split, child, far, false, true)
        }
        
        function hsplit(split, child, far, ignore, vertically) {
            var opt = {
                splitter: true,
                padding: 10
            };
            
            var psize = split.parentNode.$vbox ? "height" : "width";
            opt[psize] = split[psize];
            var splitbox = new ui[vertically ? "vsplitbox" : "hsplitbox"](opt);
            var parent = split.parentNode;
            var next = split.nextSibling
            parent.removeChild(split);
            parent.insertBefore(splitbox, next);
            splitbox.appendChild(split);
            parent.register && parent.register(splitbox);
            split.setAttribute(psize, "");
            var ratio = balance(splitbox, vertically, 1, ignore);
            
            var size = (ratio ? (100 * ratio) : 50) + "%";
            child.setAttribute(vertically ? "height" : "width", size);
            child.setAttribute(vertically ? "width" : "height", "");
            if (child.$ext)
                child.$ext.style[vertically ? "width" : "height"] = ""; //Hack because of apf weirdness
            
            if (far)
                splitbox.appendChild(child);
            else
                splitbox.insertBefore(child, split);
            
            split.setAttribute(vertically ? "height" : "width", "");
            
            return splitbox;
        }
        
        function balance(splitbox, vertically, diff, ignore) {
            var splits = [], type = splitbox.localName, node = splitbox;
            var last, ignoreIsTopLevel;
            do {
                splits.push(node);
                if (!ignoreIsTopLevel)
                    ignoreIsTopLevel = node.childNodes.indexOf(ignore) > -1;
                node = (last = node).parentNode;
            } while (node.localName == type);
            
            //Resize all left elements of the before 
            var total = count(last, type, ignore);
            var igd = (ignoreIsTopLevel ? 1 : 0);
            var factor = (total + igd) / (total + diff);
            
            if (splits.length == 1)
                return 1 / (total + 1);
            
            var child, prop = vertically ? "height" : "width";
            var split, children, inverse, value;
            for (var i = 1, l = splits.length; i < l; i++) {
                split = splits[i];
                child = splits[i - 1]
                children = split.childNodes.filter(function(x) { 
                    return x.localName != "splitter"; 
                });
                
                inverse = children[0] == child;
                if (children[0][prop]) {
                    node = children[0];
                }
                else {
                    inverse = !inverse;
                    node = children[1];
                }
                
                value = parseFloat(node[prop]);
                if (node.$ext.className.indexOf("heading") == -1) //Heading of dashboard
                    node.setAttribute(prop, inverse
                        ? (value + (100 - value) * (1 - factor)) + "%"
                        : (value * factor) + "%");
            }
        }
        
        function count(splitbox, type, ignore) {
            var total = 0;
            (function walk(node) {
                var nodes = node.childNodes;
                for (var n, i = 0, l = nodes.length; i < l; i++) {
                    if ((n = nodes[i]).localName == "splitter"
                      || n == ignore) 
                        continue;
                    
                    if (n.localName == "tab" || n.localName != type)
                        total++;
                    else
                        walk(n);
                }
            })(splitbox);
            
            return total;
        }
        
        function Widget(options, layout) {
            var plugin = new Plugin("Ajax.org", []);
            var emit = plugin.getEmitter();
            
            var dashboard = options.dashboard;
            var editor;
            
            if (typeof options == "function")
                options = options(dashboard.activeDocument 
                    && dashboard.getState(dashboard.activeDocument) || {}); //@todo pass context from form
            util.extend(options, layout);
            
            var frame = new ui[options.title ? "frame" : "bar"]({
                "class"     : "widget " + (options["class"] || ""),
                caption: options.title,
                width: options.width,
                height: options.height,
                buttons: "close",
                focussable: true,
                $focussable: true,
            });
            frame.cloud9widget = plugin;
            plugin.addElement(frame);
            
            // We can safely assume the close button was clicked
            frame.on("afterstatechange", function(e) {
                plugin.unload();
            });
            
            // Very naive temporary implementation
            plugin.on("unload", function(){
                var parent = frame.parentNode;
                var nodes = parent.childNodes;
                var child, i = 0;
                do {
                    child = nodes[i++];
                } while (child.localName == "splitter" || child == frame);
                parent.parentNode.insertBefore(child, parent);
                parent.destroy(true, true);
                
                // @todo copy width/height
                // @todo copy edge
            })
            
            plugin.freezePublicAPI({
                get editor(){ return editor; },
                get type(){ return options.type; },
                get state(){ return options[options.type]; },
                get aml(){ return frame; },
                get dashboard(){ return dashboard; },
                
                set backgroundColor(v){ },
                set title(v){ frame.setAttribute("caption", v); },
                
                vsplit: vsplit,
                hsplit: hsplit,
                
                isActive: function (){ return true; },
                activate: function(){},
                attachTo: function (parent) { 
                    if (parent)
                        parent.appendChild(frame);
                    if (editor) return;
                    
                    editors.createEditor(options.type, function(err, ed) {
                        editor = ed;
                        
                        editor.drawOn(frame.$int, frame);
                        emit("editor");
                    });
                    
                    handleEmit("widgetCreate", {widget: plugin});
                },
                className: {
                    names: ["widget", options["class"] || ""],
                    add: function(name) {
                        var idx = this.names.indexOf(name);
                        if (idx > -1) return;
                        this.names.push(name);
                        frame && frame.setAttribute("class", this.names.join(" "));
                    },
                    remove: function(){
                        for (var i = 0, l = arguments.length; i < l; i++) {
                            var idx = this.names.indexOf(arguments[i]);
                            if (idx > -1)
                                this.names.splice(idx, 1);
                        }
                        frame && frame.setAttribute("class", this.names.join(" "));
                    }
                }
            });
            
            plugin.load(null, "widget");
            
            return plugin;
        }
        
        function Factory(def) {
            
            /***** Global API *****/
            
            // Set up the generic handle
            var handle = editors.register(def.name, def.caption, Dashboard, []);
            var handleEmit = handle.getEmitter();
            
            /***** Generic Load *****/
            
            handle.on("load", function(){
            //     settings.on("read", function(e) {
            //         settings.setDefaults("editors/ace", aceSettings);
        
            //         // When loading from settings only set editor settings
            //         handleEmit("settingsUpdate", {});
            //     }, handle);
                
            //     // Listen to changes in the settings
            //     settings.on("editors/ace", updateSettings);
                
            //     handle.on("newListener", function(event, listener) {
            //         if (event == "settingsUpdate") 
            //             listener({options: lastSettings});
            //     })
                
                // CSS
                // cssString = cssString
                //     .replace(/images\//g, options.staticPrefix + "/images/")
                //     .replace(/icons\//g, options.staticPrefix + "/icons/");
                
                ui.insertCss(cssString, handle);
            });
            handle.load(def.name);
            
            function Dashboard(){
                /***** Initialization *****/
                
                var plugin = new Editor("Ajax.org", main.consumes, []);
                var emit = plugin.getEmitter();
                
                var widgets = [], states = {}, focussedWidget, unfocussed;
                var currentSession, currentDocument, container, htmlContainer;
                
                plugin.on("draw", function(e) {
                    container = e.tab;
                    htmlContainer = e.htmlNode;
                    e.htmlNode.className += " dashboard";
                    
                    // Focus Handling
                    apf.addEventListener("movefocus", function(e) {
                        var iter = e.toElement, list = [], c = 0;
                        
                        if (iter && iter != container) 
                            iter = (list[c++] = iter).parentNode;
                        if (!iter) {
                            // Editor can be unset during unload of tabs
                            if (focussedWidget && focussedWidget.editor) {
                                focussedWidget.editor.focus(false, true);
                                unfocussed = true;
                            }
                            return;
                        }
                        
                        for (var frame, i = list.length - 1; i >= 0; i--) {
                            if ((frame = list[i]).localName == "frame") {
                                var newFocus = frame.cloud9widget;
                                focusWidget(newFocus);
                                
                                unfocussed = false;
        
                                return;
                            }
                        }
                    });
                    
                    // Heading
                    var parent = loadParent(def.heading, container);
                    
                    if (def.className)
                        parent.$ext.className += " " + def.className;
                    
                    // Widgets
                    loadLayout(def.widgets, parent);
                });
                
                function loadParent(def, container) {
                    var parent = container.appendChild(new ui.vsplitbox({
                        anchors: "0 0 0 0",
                        childNodes: [
                            new ui.bar({
                                "class" : "heading",
                                height: def.height || 100
                            })
                        ]
                    }));
                    
                    var pHtml = parent.firstChild.$ext;
                    pHtml.innerHTML = "<div><img src='" + def.logo 
                        + "' /><span class='heading_title'></span></div>";
                    
                    var docel = apf.document.documentElement;
                    var button = docel.appendChild(new ui.button({
                        id: "btnCancel",
                        skin: "btn-default-css3",
                        caption: "Add Widgets",
                        "class"  : "preferences",
                        style: "display: inline-block;top: -15px;left: 10px;",
                        // submenu  : menuWidgets
                        onclick: function(){
                            var ev = new Event({});
                            ev.initEvent("transitionstart", false, false);
                            document.dispatchEvent(ev);
                            
                            if (this.caption == "Cancel") {
                                ui.setStyleClass(htmlContainer, "", ["settings"]);
                                this.setAttribute("caption", "Add Widgets");
                            }
                            else {
                                var settingsPanel = getSettingsPanel();
                                root.$int.appendChild(settingsPanel.$ext);
                                settingsPanel.show();
                                ui.setStyleClass(htmlContainer, "settings");
                                this.setAttribute("caption", "Cancel");
                            }
                        }
                    }));
                    pHtml.firstChild.appendChild(button.$ext);
                    button.dashboard = plugin;
                    plugin.addElement(button);
                    
                    button = docel.appendChild(new ui.button({
                        skin: "btn-default-css3",
                        caption: "Install Add-ons",
                        "class"  : "preferences",
                        style: "display: inline-block;top: -15px;left: 20px;",
                        submenu: menuInstall.aml
                    }));
                    pHtml.firstChild.appendChild(button.$ext);
                    plugin.addElement(button);
                    
                    return parent;
                }
                
                var root;
                function loadLayout(layout, parent) {
                    (function recur(parent, list) {
                        return list.map(function(layout) {
                            var p;
                            
                            if (layout.type == "hsplit" || layout.type == "vsplit") {
                                var options = {
                                    splitter: def.configurable,
                                    padding: 10,
                                    width: layout.width,
                                    height: layout.height
                                };
                                p = parent.appendChild(new ui[layout.type + "box"](options));
                                if (!root) root = p;
                            }
                            else {
                                addWidget(layout, parent);
                                
                                return;
                            }
                            recur(p, layout.nodes);
                        });
                    })(parent, [layout]);
                    
                    root.setAttribute("anchors", "0 0 0 0");
                    root.setAttribute("edge", "10 10 10 10");
                    
                    // if (state.focus) {
                    //     focusTab(findTab(state.focus), true)
                    // }
                }
                
                /***** Methods *****/
                
                function getState(doc, state) {
                    var session = doc.getSession();
            
                    widgets.forEach(function(widget) {
                        var editor = widget.editor;
                        // state[editor.type] = editor.getState(session.documents[editor.name]);
                    });
                    
                    // state.layout =
                    state.app = session.app;
                    state.type = session.type;
                }
                
                function setState(doc, state) {
                    var session = doc.getSession();
                    
                    widgets.forEach(function(widget) {
                        var editor = widget.editor;
                        editor.setState(session.documents[editor.name], state[editor.type]);
                    });
                    
                    // parse state.layout.
                    session.app = state.app;
                    session.type = state.type;
                }
                
                function addWidget(layout, parent, vertical, splitNode) {
                    var options = findWidget(layout.id).def;
                    options.dashboard = plugin;
                    var widget = new Widget(options, layout);
                    widget.on("editor", function(){
                        widgets.push(widget);
                        states[widget.editor.name] = widget.state;
                    });
                    widget.on("unload", function(){
                        widgets.splice(widgets.indexOf(plugin), 1);
                    });
                    
                    if (!parent) {
                        if (root.childNodes < 3) {
                            widget.attachTo(root);
                        }
                        else {
                            var child = splitNode || root.firstChild;
                            if (child.localName == "splitter")
                                child = child.nextSibling;
                            hsplit(child, widget.aml, false, null, vertical);
                            widget.attachTo();
                        }
                    }
                    else {
                        widget.attachTo(parent);
                    }
                    
                    if (currentSession) {
                        var doc = initWidget(widget, currentSession);
                        widget.editor.loadDocument(doc);
                    }
                    
                    return widget;
                }
                
                function initWidget(widget, session) {
                    var editor = widget.editor;
                    var state = util.extend(session.state[editor.type] || {}, states[editor.name]);
                    
                    var widgetState = { value : state.value };
                    widgetState[editor.type] = state;
                    
                    var doc = new Document(widgetState);
                    doc.tab = widget; //Some plugins only know tab
                    doc.widget = widget;
                    
                    editor.loadDocument(doc);
                    session.documents[editor.name] = doc;
                    
                    return doc;
                }
                
                function focusWidget(widget) {
                    if (focussedWidget != widget) {
                        // Blur
                        if (focussedWidget) {
                            emit("blur", {widget: focussedWidget});
                            
                            // During destroy of the pane the editor can 
                            // not exist for a widget
                            if (focussedWidget.editor)
                                focussedWidget.editor.blur();
                            
                            focussedWidget.classList.remove("focus");
                        }
                        
                        if (!widget) {
                            focussedWidget = null;
                            unfocussed = true;
                            return;
                        }
                        
                        // Change focussedWidget
                        focussedWidget = widget;
                        
                        // Focus
                        if (!unfocussed && focussedWidget.editor)
                            focussedWidget.editor.focus();
                        
                        focussedWidget.classList.add("focus");
                    }
                    else {
                        if (!focussedWidget)
                            return;
                        
                        if (!unfocussed && focussedWidget.editor)
                            focussedWidget.editor.focus(true);
                    }
                    
                    emit("focus", { widget : widget });
                    
                    return widget;
                }
                
                /***** Lifecycle *****/
                
                plugin.on("load", function(){
                    
                });
                
                plugin.on("documentLoad", function(e) {
                    var doc = e.doc;
                    var session = doc.getSession();
                    
                    // Value Retrieval
                    doc.on("getValue", function get(e) { 
                        return session.session
                            ? session.session.getValue()
                            : e.value;
                    }, session);
                    
                    // Value setting
                    doc.on("setValue", function set(e) { 
                        //e.value
                    }, session);
                    
                    // Prevent existing session from being reset
                    if (session.documents)
                        return;
                    
                    session.documents = {};
                    session.state = e.state;
                    widgets.forEach(function(widget) {
                        initWidget(widget, session);
                    });
                    
                    if (e.state) {
                        setState(doc, e.state);
                        session.title = e.state.app;
                    }
                    
                    doc.tab.backgroundColor = def.heading.backgroundColor
                    if (def.heading.dark)
                        doc.tab.classList.add("dark");
                });
                plugin.on("documentActivate", function(e) {
                    //editor.value = e.doc.value;
                    currentDocument = e.doc;
                    currentSession = e.doc.getSession();
                    
                    widgets.forEach(function(widget) {
                        var editor = widget.editor;
                        var doc = currentSession.documents[editor.name];
                        if (!doc) doc = initWidget(widget, currentSession);
                        editor.loadDocument(doc);
                    });

                    container.$ext.querySelector(".heading_title").innerHTML 
                        = uCaseFirst(currentSession.title || "") + " Dashboard";
                });
                plugin.on("documentUnload", function(e) {
                    var session = e.doc.getSession();
                    widgets.forEach(function(widget) {
                        var editor = widget.editor;
                        var doc = session.documents[editor.name];
                        if (doc) editor.unloadDocument(doc);
                    });
                    if (session == currentSession) {
                        currentSession = currentDocument = null;
                    }
                });
                plugin.on("getState", function(e) {
                    getState(e.doc, e.state);
                });
                plugin.on("setState", function(e) {
                    setState(e.doc, e.state);
                });
                plugin.on("clear", function(){
                });
                plugin.on("blur", function(){
                });
                plugin.on("focus", function(e) {
                });
                plugin.on("enable", function(){
                });
                plugin.on("disable", function(){
                });
                plugin.on("unload", function(){
                    container.innerHTML = "";
                    container = null;
                });
                
                /***** Register and define API *****/
                
                /**
                 * Read Only Image Editor
                 **/
                plugin.freezePublicAPI({
                    get focussed(){ return !unfocussed; },
                    get focussedWidget(){ return focussedWidget; },
                    get widgets(){ return widgets.slice(0); },
                    get configurable(){ return def.configurable; },
                    get root(){ return root; },
                    
                    addWidget: addWidget
                });
                
                // Emit create event on handle
                handleEmit.sticky("create", {dashboard: plugin}, plugin);
                
                plugin.load(null, "dashboard");
                
                return plugin;
            }
            
            return handle;
        }
        
        register(null, {
            dashboard: handle
        });
    }
});