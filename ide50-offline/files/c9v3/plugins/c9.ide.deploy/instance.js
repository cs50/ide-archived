/**
 * Editor object for the Cloud9
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, module, exports) {
    main.consumes = ["Plugin", "ui"];
    main.provides = ["deployinstance"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;

        /**
         * Deploy Instance
         * 
         * @property fileExtensions {String[]}  Array of file extensions supported by this editor
         * 
         * @event documentLoad Fires when a document is loaded into the editor.
         *   This event is also fired when this document is attached to another
         *   instance of the same editor (in a split view situation). Often you
         *   want to keep the session information partially in tact when this
         *   happens.
         * @param {Object} e
         *     doc    {Document} the document that is loaded into the editor
         *     state  {Object} state that was saved in the document
         */
         function Instance(options) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();

            var state = "idle", item, frame, htmlNode, btnSettings, btnDeploy;
            var where;
            
            function setState(v) { 
                state = v;
                item.$ext.className = "deploy-item " + state + " " + options.type;
                
                btnSettings.setAttribute("disabled", !(state == plugin.IDLE 
                  || state == plugin.ERROR || state == plugin.AUTH));
                btnDeploy.setAttribute("visible", 
                    state != plugin.CREATING && state != plugin.AUTH);
                btnDeploy.setAttribute("disabled", 
                    state == plugin.WORKING || state == plugin.DELETING);
            
                render();
            }
            
            function render(){ 
                if (emit("render", { htmlNode: htmlNode, instance: plugin }) === false)
                    return;

                // Code for rename
                htmlNode.addEventListener("mouseup", function(e) {
                    var htmlNode = e.target;
                    if (htmlNode.className == "title" && htmlNode.contentEditable !== true) {
                        htmlNode.contentEditable = true;
                        htmlNode.className = "title editable";
                        
                        // Select content
                        var t = htmlNode.firstChild;
                        var r = document.createRange();
                        r.setStart(t, 0); r.setEnd(t, t.nodeValue.length);
                        
                        var s = window.getSelection();
                        s.removeAllRanges();
                        s.addRange(r);
                        
                        function done(){
                            htmlNode.className = "title"
                            htmlNode.contentEditable = false;
                            htmlNode.removeEventListener("blur", done);
                            htmlNode.removeEventListener("keydown", keydown);
                            
                            var name = htmlNode.textContent;
                            if (name == plugin.meta.name) return;
                            
                            emit("rename", { 
                                instance: plugin,
                                name: name, 
                                oldname: plugin.meta.name
                            });
                        }
                        function keydown(e) { 
                            if (e.keyCode == 27) done(); 
                            if (e.keyCode == 13) {
                                done();
                                e.preventDefault();
                            }
                        }
                        
                        htmlNode.addEventListener("blur", done);
                        htmlNode.addEventListener("keydown", keydown);
                    }
                });
            }
            
            function update(meta) {
                for (var prop in meta)
                    options.meta[prop] = meta[prop];
                
                render();
            }
            
            function attachTo(toFrame, toWhere) {
                if (frame && frame.childNodes.length == 2) {
                    // Hide Empty Message
                    frame.firstChild.show();
                }
                
                where = toWhere;
                frame = toFrame;
                if (!item) {
                    item = frame.appendChild(new ui.bar({
                        skinset: "deploy",
                        "class" : "idle",
                        childNodes: [
                            btnDeploy = new ui.button({
                                caption: options.button || "Deploy Now",
                                skinset: "default",
                                skin: "btn-default-css3",
                                "class"     : "deploynow",
                                zindex: 10,
                                left: 5,
                                bottom: 5,
                                focussable: true,
                                $focussable: true,
                                onclick: function(){
                                    var btn = this;
                                    
                                    if (btn.caption == "Cancel") {
                                        emit("cancel", {
                                            instance: plugin,
                                            done: function(){
                                                btn.setAttribute("caption", "Deploy Now");
                                            }
                                        })
                                    }
                                    else {
                                        btn.setAttribute("caption", "Cancel");
                                        emit("deploy", {
                                            instance: plugin,
                                            done: function(){
                                                btn.setAttribute("caption", "Deploy Now");
                                            }
                                        });
                                    }
                                }
                            }),
                            new ui.button({
                                "class" : "close",
                                zindex: 10,
                                right: 5,
                                top: 5,
                                onclick: function(){
                                    emit("destroy", { instance: plugin });
                                }
                            }),
                            btnSettings = new ui.button({
                                "class"  : "settings",
                                zindex: 11,
                                right: 3,
                                bottom: 2,
                                disabled: true
                            }),
                        ]
                    }));
                    
                    htmlNode = document.createElement("div");
                    item.$int.appendChild(htmlNode);
                    htmlNode.className = "content";
                    
                    btnSettings.setAttribute("submenu", options.menu.aml);
                    options.menu.aml.on("prop.visible", function(e) {
                        if (e.value && options.menu.aml.opener == btnSettings)
                            options.menu.meta.instance = plugin;
                    }, true);
                }
                else {
                    frame.appendChild(item);
                }
                
                render();
                
                // Hide Empty Message
                frame.firstChild.hide();
            }
            
            plugin.on("unload", function(){
                item.destroy(true, true);
                
                if (frame.childNodes.length == 1)
                    frame.firstChild.show();
            });

            plugin.freezePublicAPI({
                CREATING: "creating",
                ERROR: "error",
                IDLE: "idle",
                DEPLOYING: "deploying",
                AUTH: "auth",
                WORKING: "working",
                DELETING: "deleting",
                
                type: options.type,
                meta: options.meta || {},
                
                log: {
                    log: [],
                    add: function(type, message) {
                        this.log.push({ type: type, message: message });
                    }
                },
                
                get where(){ return where; },
                get state(){ return state; },
                set state(v){ setState(v); },
                
                /**
                 * 
                 */
                update: update,
                
                /**
                 * 
                 */
                attachTo: attachTo
            });
            
            plugin.load(null, "deployinstance");
            
            return plugin;
        }   
        
        /***** Register and define API *****/
        
        register(null, {
            deployinstance: Instance
        })
    }
});
