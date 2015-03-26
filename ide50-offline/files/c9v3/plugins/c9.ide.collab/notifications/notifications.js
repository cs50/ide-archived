/*global window apf console*/
define(function(require, exports, module) {
"use strict";

    main.consumes = ["CollabPanel", "ui", "api", "dialog.alert", "c9", "panels", "collab.workspace"];
    main.provides = ["notifications"];
    return main;

    function main(options, imports, register) {
        var CollabPanel = imports.CollabPanel;
        var c9 = imports.c9;
        var ui = imports.ui;
        var api = imports.api;
        var panels = imports.panels;
        var alert = imports["dialog.alert"].show;
        var workspace = imports["collab.workspace"];

        var css = require("text!./notifications.css");
        var staticPrefix = options.staticPrefix;

        var oop = require("ace/lib/oop");
        var Tree = require("ace_tree/tree");
        var TreeData = require("./notificationsdp");

        var plugin = new CollabPanel("Ajax.org", main.consumes, {
            name: "notifications",
            index: 150,
            caption: "Notifications",
            height: "20%"
        });
        
        // var emit = plugin.getEmitter();

        // added notification types as classes below
        var NOTIFICATION_TYPES = {};

        var notificationsParent, notificationsTree, notificationsDataProvider;
        var frame, panelButton, bubble;
        // var visible = false;

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;

            // Needed now for bubble
            ui.insertCss(css, staticPrefix, plugin);

            c9.once("ready", function() {
                setTimeout(loadNotifications, 10000);
            });

            if (!options.hosted && c9.debug) {
                // standalone version test
                addNotifications([
                    { name: "Bas de Wachter", uid: 8, email: "bas@c9.io", type: "access_request" },
                    { name: "Mostafa Eweda", uid: 1, email: "mostafa@c9.io", type: "access_request" },
                    { name: "Lennart Kats", uid: 5,  email: "lennart@c9.io", type: "access_request" },
                    { name: "Ruben Daniels", uid: 2, email: "ruben@ajax.org", type: "access_request" },
                    { name: "Fabian Jakobs", uid: 4, email: "fabian@ajax.org", type: "access_request" }
                ]);
            }
            
            workspace.on("notification", function(notif) {
                addNotifications(notif);
                postLoadedNotifications();
            });
        }

        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;

            notificationsParent = options.html;

            frame = options.aml;
            
            // Notifications panel
            notificationsTree = new Tree(notificationsParent);
            notificationsDataProvider = new TreeData();
            notificationsTree.renderer.setScrollMargin(0, 10);
            notificationsTree.renderer.setTheme({cssClass: "notificationstree"});
            notificationsTree.setOption("maxLines", 3);
            // Assign the dataprovider
            notificationsTree.setDataProvider(notificationsDataProvider);

            notificationsTree.on("mousedown", function(e) {
                var domTarget = e.domEvent.target;

                var pos = e.getDocumentPosition();
                var notif = notificationsDataProvider.findItemAtOffset(pos.y);
                if (!notif || !domTarget)
                    return;

                notif.handleMouseDown(e);
            });
            
            notificationsTree.on("mouseup", function(e) {
                var domTarget = e.domEvent.target;

                var pos = e.getDocumentPosition();
                var notif = notificationsDataProvider.findItemAtOffset(pos.y);
                if (!notif || !domTarget)
                    return;

                notif.handleMouseUp(e);
            });
            
            plugin.on("hide", function(e) {
                notificationsTree.renderer.freeze();
            });
            plugin.on("show", function(e) {
                notificationsTree.renderer.unfreeze();
                notificationsTree.renderer.$loop.schedule(notificationsTree.renderer.CHANGE_FULL);
            });
            
            // onNotificationsLoaded();
            // notificationsDataProvider.emptyMessage = "Loading Notifications ...";
            // loadNotifications();
            if (!cachedNotifications.length)
                setTimeout(function() {frame.minimize();}, 10);
            postLoadedNotifications();
        }

        var cachedNotifications = [];
        function loadNotifications() {
            if (!options.isAdmin || !options.hosted)
                return postLoadedNotifications();

            api.collab.get("members/list?pending=1", function (err, members) {
                if (err && err.code === 0) {
                    // Server still starting or CORS error; retry
                    return setTimeout(loadNotifications, 20000);
                }
                
                if (err) return alert(err);

                if (Array.isArray(members)) {
                    var notifs = members.map(function(m) {
                        m.type = "access_request";
                        return m;
                    });
                    cachedNotifications = [];
                    addNotifications(notifs);
                    postLoadedNotifications();
                }
            });
        }

        function postLoadedNotifications() {
            if (!bubble && cachedNotifications.length) {
                // Make sure collab panel is enabled
                panels.enablePanel("collab");
                
                // Notification Bubble
                panelButton = document.querySelector(".panelsbutton.collab");
                bubble = panelButton.appendChild(document.createElement("div"));
                bubble.className = "newnotifs";
            }
            
            if (!cachedNotifications.length) {
                if (drawn) {
                    notificationsDataProvider.emptyMessage = "No pending notifications";
                    frame.setHeight(50);
                }
                if (bubble) 
                    bubble.style.display = "none";
            }
            else {
                if (drawn)
                    frame.setHeight(Math.min(cachedNotifications.length, 3) * 50 + 22);
                if (bubble) {
                    bubble.innerHTML = cachedNotifications.length;
                    bubble.style.display = "block";
                    bubble.className = "newnotifs size" + String(cachedNotifications.length).length;
                }
            }
            
            if (!drawn)
                return;
            
            frame.setAttribute("caption", 
                "Notifications (" + cachedNotifications.length + ")");
            
            onNotificationsLoaded();
        }

        function addNotifications(notifs) {
            if (!Array.isArray(notifs))
                notifs = [notifs];
                
            if (frame)
                frame.restore();
                
            notifs.forEach(function(notif) {
                var NotifConstructor = NOTIFICATION_TYPES[notif.type];
                if (!NotifConstructor)
                    console.error("Invalid notification type:", notif.type);
                cachedNotifications.push(new NotifConstructor(notif));
            });
        }

        function onNotificationsLoaded() {
            notificationsDataProvider.setRoot(cachedNotifications);
            if (frame && cachedNotifications.length)
                frame.restore();
        }

        /***** Notification Object *****/
        
        function Notification(datarow) {
            this.datarow = datarow;
        }

        (function () {
            this.getHTML = function (datarow) {
                throw new Error("No impl found - getHTML");
            };

            this.handleMouseDown = function () {
                throw new Error("No impl found - handleMouseDown");
            };

            this.remove = function () {
                var _self = this;
                cachedNotifications = cachedNotifications.filter(function (notif) {
                    return notif !== _self;
                });
                postLoadedNotifications();
            };
        }).call(Notification.prototype);

        function AccessRequestNotification(datarow) {
            datarow.md5Email = datarow.email ? apf.crypto.MD5.hex_md5(datarow.email.trim().toLowerCase()) : "";
            this.datarow = datarow;
        }

        oop.inherits(AccessRequestNotification, Notification);

        (function () {
            this.getHTML = function () {
                var datarow = this.datarow;
                var avatarImg = '<img class="gravatar-image" src="https://secure.gravatar.com/avatar/' +
                    datarow.md5Email + '?s=37&d=retro" />';
                var html = [
                    "<span class='avatar'>", avatarImg, "</span>",
                    "<span class='body'>", "<span class='caption'>", datarow.name, "</span>", 
                    " requests access to this workspace</span>",
                    "<span class='actions access_request'>",
                        '<div class="standalone access_control rw">',
                            '<div class="readbutton">R</div><div class="writebutton">RW</div>',
                        '</div>',
                        '<div class="btn-default-css3 btn-green grant">',
                            '<div class="caption">Grant</div>',
                        '</div>',
                        '<div class="btn-default-css3 btn-red deny">',
                            '<div class="caption">Deny</div>',
                        '</div>',
                    "</span>"
                ];

                return html.join("");
            };

            this.acceptRequest = function (access) {
                var _self = this;
                if (!options.hosted)
                    return requestAccepted();
                    
                var datarow = this.datarow;
                var uid = datarow.uid;
                api.collab.post("accept_request", {
                    body: {
                        uid: uid,
                        access: access
                    }
                }, function (err, data, res) {
                    if (err) return alert("Error", err);
                    requestAccepted();
                });
                function requestAccepted() {
                    datarow.acl = access;
                    workspace.addMemberNonPubSub(datarow);
                    _self.remove();
                }
            };

            this.denyRequest = function () {
                var _self = this;
                if (!options.hosted)
                    return requestDenied();
                    
                var uid = this.datarow.uid;
                api.collab.post("deny_request", {
                    body: {
                        uid: uid
                    }
                }, function (err, data, res) {
                    if (err) return alert("Error", err);
                    requestDenied();
                });
                function requestDenied() {
                    _self.remove();
                }
            };

            this.handleMouseDown = function (e) {
                var target = e.domEvent.target;
                var className = target.classList;
                if (className.contains("access_control")) {
                    var actionArr = className.contains("rw") ? ["rw", "r"] : ["r", "rw"];
                    className.remove(actionArr[0]);
                    className.add(actionArr[1]);
                    return;
                }
            };
            
            this.handleMouseUp = function (e) {
                var target = e.domEvent.target;
                var className = target.classList;
                if (className.contains("grant")) {
                    var rwClassName = target.previousSibling.classList;
                    var access = rwClassName.contains("rw") ? "rw" : "r";
                    this.acceptRequest(access);
                }
                else if (className.contains("deny")) {
                    this.denyRequest();
                }
            };
        }).call(AccessRequestNotification.prototype);

        NOTIFICATION_TYPES["access_request"] = AccessRequestNotification;
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
            plugin.once("draw", draw);
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
         * Adds File->New File and File->New Folder menu items as well as the
         * commands for opening a new file as well as an API.
         * @singleton
         **/
        plugin.freezePublicAPI({
        });

        register(null, {
            notifications: plugin
        });
    }

});