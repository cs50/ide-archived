define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "preview", "MenuItem", "Menu", "Divider", "tabManager",
        "error_handler"
    ];
    main.provides = ["Previewer"];
    return main;

    function main(options, imports, register) {
        var Menu = imports.Menu;
        var Plugin = imports.Plugin;
        var preview = imports.preview;
        var errorHandler = imports.error_handler;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var tabs = imports.tabManager;
        
        function Previewer(developer, deps, options) {
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();
            emit.setMaxListeners(1000);
            
            var caption = options.caption;
            var onclick = options.onclick;
            var submenu = options.submenu;
            var divider = options.divider;
            var selector = options.selector || function(){ return false; };
            var index = options.index || 100;
            var menu, item, div;
            
            var currentSession, currentDocument;
            
            plugin.on("load", function(){
                preview.register(plugin, selector);
                
                var rootMenu = preview.previewMenu;
                
                item = rootMenu.append(new MenuItem({ 
                    caption: caption, 
                    position: index
                }));
                
                if (onclick || !submenu)
                    item.on("click", onclick || function(){
                        var editor = tabs.focussedTab.editor;
                        editor.setPreviewer(plugin.name);
                    });
                    
                if (submenu) {
                    item.submenu = menu = submenu instanceof Menu
                        ? submenu : new Menu({}, plugin);
                }
                
                if (divider)
                    div = rootMenu.append(new Divider({ position: index + 10 }));
                
                tabs.on("focusSync", function(e) {
                    if (e.tab.editorType == "preview") {
                        var session = e.tab.document.getSession();
                        if (session.previewer == plugin) {
                            if (currentSession != session) {
                                activateDocument(e.tab.document);
                            }
                        }
                    }
                });
            });
            
            /***** Methods *****/
            
            function loadDocument(doc, editor, state) {
                if (!doc.meta.$previewInited) {
                    doc.addOther(function(){ navigate({ doc: doc }, true); });
                    doc.meta.$previewInited = true;
                }
                
                if (state)
                    setState(doc, state);
                emit("documentLoad", { doc: doc, editor: editor, state: state });
            }
            
            function unloadDocument(doc, options) {
                if (!options) options = {};
                options.doc = doc;
                emit("documentUnload", options);
            }
            
            function activateDocument(doc) {
                currentDocument = doc;
                currentSession = doc.getSession();
                
                emit("documentActivate", { doc: currentDocument });
            }
            
            function deactivateDocument(doc) {
                currentDocument = null;
                currentSession = null;
                
                emit("documentDeactivate", { doc: doc });
            }
            
            function update(e) { 
                if (currentDocument && currentDocument.getSession().previewTab
                    && e.doc == currentDocument.getSession().previewTab.document) {
                    e.previewDocument = e.doc;
                    emit("update", e);
                }
            }
            
            function reload(){ 
                emit("reload", { session: currentSession }); 
            }
            
            function popout(){ 
                emit("popout");
            }
            
            function navigate(e, remove) {
                var session = e && e.doc ? e.doc.getSession() : currentSession;
                var doc;
                
                if (!session) {
                    // todo remove this after a while
                    var err = new Error("navigate called without session");
                    errorHandler.reportError(err, {doc: !!(e && e.doc) , remove: remove}, ["collab"]);
                    return;
                }
                
                if (session.previewTab) {
                    doc = session.previewTab.document;
                    
                    // Remove previous change listener
                    if (session.changeListener)
                        doc.undoManager.off("change", session.changeListener);
                    
                    // Remove previous path listener
                    if (session.renameListener)
                        doc.tab.off("path.set", session.renameListener);
                }
                
                if (remove) return; // For cleanup
                
                // Find new tab
                e.tab = session.previewTab = tabs.findTab(session.path);
                e.session = session;
                
                session.changeListener = function(){
                    update({
                        doc: doc,
                        saved: session.previewTab
                            .document.undoManager.isAtBookmark()
                    });
                };
                session.renameListener = function(e) {
                    navigate({ url: e.path, doc: doc });
                };
                
                // Set new change listener
                if (session.previewTab) {
                    doc = session.previewTab.document;
                    
                    // Listen to value changes
                    doc.undoManager.on("change", session.changeListener);
                    
                    // Listen to path changes
                    doc.tab.on("setPath", session.renameListener);
                }
                
                if (session == currentSession)
                    emit("navigate", e); 
                
                session.path = e.url;
            }
            
            function getState(doc, state) {
                emit("getState", {
                    doc: doc,
                    state: state
                });
                
                return state;
            }
            
            function setState(doc, state) {
                emit("setState", {
                    doc: doc,
                    state: state || {}
                });
            }
            
            function focus(regain, lost) {
                emit("focus", {
                    regain: regain || false,
                    lost: lost || false
                });
            }
            
            function blur(){
                emit("blur");
            }
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();
            
            /**
             * Previewer base class for the {@link Preview preview pane}.
             * 
             * A previewer registers for certain type of content, based on a
             * filename or path. The content can be displayed through any means
             * possible in the browser. Many previewers create an iframe in which
             * they render content. Others just update a div with some generated
             * result.
             * 
             * Creating a previewer is very much like creating an editor. There
             * is a set of events that can be hooked to implement behavior.
             * 
             * The event flow of a previewer plugin is as follows:
             * 
             * * {@link #event-documentLoad} - *A source file is previewed*
             * * {@link #event-documentActivate} - *A source file is now active in the previewer*
             * * {@link #event-update} - *The contents of the source file is updated*
             * * {@link #event-documentDeactivate} - *Another document is loaded as the active document in the previewer*
             * * {@link #event-documentUnload} - *The tab for this preview is closed*
             * 
             * This is in addition to the event flow of the {@link Plugin} base class.
             * 
             * #### User Actions:
             * 
             * * {@link #event-reload} - *Refresh the contents*
             * * {@link #event-navigate} - *Load a different file to preview in the same session*
             * * {@link #event-focus} - *The previewer got focus*
             * * {@link #event-blur} - *The previewer lost focus*
             * 
             * Implementing your own debug panel takes a new Previewer() object 
             * rather than a new Plugin() object. Here's a short example:
             * 
             *     var plugin = new Previewer("(Company) Name", main.consumes, {
             *         caption  : "HTML",
             *         index    : 10,
             *         divider  : true,
             *         selector : function(path) {
             *             return path.match(/(?:\.html|\.htm|\.xhtml)$|^https?\:\/\//);
             *         }
             *     });
             * 
             *     plugin.on("documentLoad", function(e) {
             *         var session = e.doc.getSession();
             *         if (!session.iframe)
             *             session.iframe = createIframe();
             *         e.editor.container.appendChild(session.iframe);
             *     });
             *     
             *     plugin.on("documentActivate", function(e) {
             *         var session = e.doc.getSession();
             *         session.iframe.style.display = "block";
             *     });
             *     
             *     plugin.on("documentDeactivate", function(e) {
             *         var session = e.doc.getSession();
             *         session.iframe.style.display = "none";
             *     });
             *     
             *     plugin.on("update", function(e) {
             *         var value = e.previewDocument.value;
             *         var session = e.doc.getSession();
             *         updateContent(session.iframe, value);
             *     });
             * 
             *     // etc...
             *     
             *     plugin.freezePublicAPI({
             *     });
             * 
             * @class Previewer
             * @extends Plugin
             */
            /**
             * @constructor
             * Creates a new Previewer instance.
             * @param {String}         developer          The name of the developer of the plugin
             * @param {String[]}       deps               A list of dependencies for this 
             *   plugin. In most cases it's a reference to `main.consumes`.
             * @param {Object}         options            The options for the previewer.
             * @param {String}         options.caption    The caption of the menu item.
             * @param {Boolean/Menu}   [options.submenu]  Specifies whether to create a submenu. If a menu is specified, it will be used as submenu instead.
             * @param {Divider}        [options.divider]  Specifies whether to create a divider below the menu item.
             * @param {Number}         [options.index]    The position of the menu item in the menu
             * @param {Function}       [options.selector] Return true if your previewer can handle the content.
             * @param {String}         [options.path]     The path of the file that is to be previewed.
             * @param {Function}       [options.onclick]  A function that is called when the user clicks on the menu item.
             */
            plugin.freezePublicAPI({
                /**
                 * @property {Menu} menu The sub menu for the previewer menu item (if any).
                 * @readonly
                 */
                get menu(){ return menu; },
                /**
                 * @property {MenuItem} item The menu item for the preview menu.
                 * @readonly
                 */
                get item(){ return item; },
                /**
                 * @property {Divider} divider The divider for the previewer menu (if any).
                 * @readonly
                 */
                get divider(){ return div; },
                
                /**
                 * @property {Document} activeDocument The document that is currently 
                 *   active (visible) in this previewer.
                 * @readonly
                 */
                get activeDocument(){ return currentDocument; },
                /**
                 * @property {Session} activeSession The session that belongs to the active 
                 *   document. This can also be retrieved using 
                 *   `previewer.activeDocument.getSession()`.
                 * @readonly
                 */
                get activeSession(){ return currentSession; },
                
                _events: [
                    /** 
                     * Fires when a document is loaded into the previewer.
                     * This event is also fired when this document is attached to another
                     * instance of the same previewer (in a split view situation). Often you
                     * want to keep the session information partially in tact when this
                     * happens.
                     * 
                     * *N.B.: The document that is loaded is the document that 
                     * belongs to the preview editor. It is *not* the document 
                     * that is going to be previewed. The document to preview
                     * is accessible via the session: 
                     * `doc.getSession().previewTab.document`.*
                     * 
                     * @event documentLoad 
                     * @param {Object}   e
                     * @param {Document} e.doc     the document that is loaded into the previewer
                     * @param {Object}   e.state   state that was saved in the document
                     * @param {Editor}   e.editor  the instance of the {@link Preview} editor
                     */
                    "documentLoad",
                    /** 
                     * Fires when a document becomes the active document of a previewer
                     * This event is called every time a tab becomes the active tab of
                     * a pane. Use it to show / hide whatever is necessary.
                     * 
                     * *N.B.: The document that is activated is the document that 
                     * belongs to the preview editor. It is *not* the document 
                     * that is going to be previewed. The document to preview
                     * is accessible via the session: 
                     * `doc.getSession().previewTab.document`.*
                     * 
                     * @event documentActivate
                     * @param {Object}   e
                     * @param {Document} e.doc  the document that is activate
                     */
                    "documentActivate",
                    /**
                     * Fires when a document stops being the active document of a previewer
                     * This event is called every time a tab stops being the active tab of
                     * a pane. Use it to show / hide whatever is necessary.
                     * 
                     * *N.B.: The document that is deactivated is the document that 
                     * belongs to the preview editor. It is *not* the document 
                     * that is going to be previewed. The document to preview
                     * is accessible via the session: 
                     * `doc.getSession().previewTab.document`.*
                     * 
                     * @event documentDeactivate
                     * @param {Object}   e
                     * @param {Document} e.doc  the document that is activate
                     */
                    "documentDeactivate",
                    /**
                     * Fires when a document is unloaded from the previewer.
                     * This event is also fired when this document is attached to another
                     * instance of the previewer (in a split view situation).
                     * 
                     * *N.B.: The document that is unloaded is the document that 
                     * belongs to the preview editor. It is *not* the document 
                     * that is going to be previewed. The document to preview
                     * is accessible via the session: 
                     * `doc.getSession().previewTab.document`.*
                     * 
                     * @event documentUnload
                     * @param {Object}   e
                     * @param {Document} e.doc  the document that was loaded into the previewer
                     */
                    "documentUnload",
                    /** 
                     * Fires when the state of the previewer is retrieved
                     * @event getState
                     * @param {Object}   e
                     * @param {Document} e.doc    the document for which the state is retrieved
                     * @param {Object}   e.state  the state to add values to {See #getState}
                     */
                    "getState",
                    /** 
                     * Fires when the state of the previewer is set
                     * @event setState
                     * @param {Object}   e
                     * @param {Document} e.doc    the document for which the state is set
                     * @param {Object}   e.state  the state that is being set
                     */
                    "setState",
                    /** 
                     * Fires when the previewer gets the focus. See also 
                     * {@link tabManager#focusTab}, {@link tabManager#focussedTab}
                     * @event focus
                     * @param {Object}  e
                     * @param {Boolean} e.regain whether the focus is regained. 
                     *   This means that the previewer had lost the focus 
                     *   previously (the focus event with e.lost set to true 
                     *   was called.) and now the focus has been given back to 
                     *   the tabs.
                     * @param {Boolean} e.lost   whether the focus is lost, 
                     *   while the previewer remains the focussed previewer. This 
                     *   happens when an element outside of the previewers 
                     *   (for instance the tree or a menu) gets the focus.
                     */
                    "focus",
                    /** 
                     * Fires when the previewer looses focus.
                     * @event blur
                     */
                    "blur",
                    /**
                     * Fires when the document that is being previewed is updated.
                     * @event update
                     * @param {Object}   e
                     * @param {Document} e.doc              The document of the previewer.
                     * @param {Document} e.previewDocument  The document of the file that is being previewed, if any.
                     * @param {Boolean}  e.saved            Whether the content has been saved to disk.
                     */
                    "update",
                    /**
                     * Fires when the user reloads the contents.
                     * @event reload
                     */
                    "reload",
                    /**
                     * Fires when the user would like the plugin to popout in it's own window.
                     * @event popout
                     */
                    "popout",
                    /**
                     * Fires when the user requests a different location to be previewed.
                     * @event navigate
                     * @param {Object}   e
                     * @param {Document} e.doc The document of the previewer.
                     * @param {String}   e.url The url or path that the user entered in the location box.
                     */
                    "navigate"
                ],
                    
                /**
                 * Unloads the document from this editor.
                 * @private
                 */
                unloadDocument: unloadDocument,
                
                /**
                 * Loads the document in this editor to be displayed.
                 * @param {Document} doc the document to display
                 */
                loadDocument: loadDocument,
                
                /**
                 * Sets the focus to this editor
                 */
                focus: focus,

                /**
                 * Removes the focus from this editor
                 */
                blur: blur,
                
                /**
                 * Sets the document as the active document.
                 * @param {Document} doc the document to activate
                 */
                activateDocument: activateDocument,
                
                /**
                 * Clears the document as the active document.
                 * @param {Document} doc the document to deactivate
                 */
                deactivateDocument: deactivateDocument,
                
                /**
                 * Reload the preview of the active document.
                 */
                reload: reload,
                
                /**
                 * Pop the preview out into it's own window.
                 */
                popout: popout,
                
                /**
                 * @ignore
                 */
                navigate: navigate,
                
                /**
                 * Retrieves the state of a previewer
                 * @param {Document} doc the document for which to return the state
                 * @return {Object}
                 */
                getState: getState, 
                
                /**
                 * Sets the state of this previewer
                 * @param {Document} doc the document for which to set the state
                 * @param {Object} state the state of the document for this editor
                 */
                setState: setState
            });
            
            return plugin;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            Previewer: Previewer
        });
    }
});