/*global UserSnap _usersnapconfig*/

define(function(require, exports, module) {
    main.consumes = ["Plugin", "ui", "c9", "auth", "menus", "layout", "info"];
    main.provides = ["feedback"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var menus = imports.menus;
        var layout = imports.layout;
        var auth = imports.auth;
        var info = imports.info;
        
        var markup = require("text!./feedback.xml");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var form, confirmation, btnSend, btnClose, description, win;
        var confirmationMessage;

        var usApiKey = options.userSnapApiKey; 
        var screenshotSupport = options.screenshotSupport; 
        var baseurl = options.baseurl;
        var FILEFEEDBACK_URL = "/api/context/feedback";
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            menus.once("ready", function(){
                if (screenshotSupport)
                    initMenuWithScreenshotSupport();
                else
                    initMenuWithoutScreenshotSupport();
            });
        }
        
        function initMenuWithScreenshotSupport(){
            var mnuFeedback = new ui.menu();

            menus.addItemByPath("Beta Feedback/", mnuFeedback, 10000, plugin);
            var item = menus.get("Beta Feedback").item;
            item.class = "betafeedback";

            var parent = layout.findParent({name: 'help'});
            ui.insertByIndex(parent, item, 500, plugin);
            
            var c = 0;
            menus.addItemByPath("Beta Feedback/Short Message", new ui.item({ 
                onclick: function(){ showFeedbackDialog(); },
                class: "betafeedback"
            }), c += 100, plugin);
            menus.addItemByPath("Beta Feedback/With Screenshot", new ui.item({ 
                onclick: function() {
                    draw();
                    setTimeout(function wait(){
                        if (typeof UserSnap !== "undefined") {
                            var email = info.getUser().email;
                            UserSnap.setEmailBox(email); 
                            UserSnap.openReportWindow();
                        }
                        else {
                            setTimeout(wait, 50);
                        }
                    }, 10);
                },
                class: "betafeedback"
            }), c += 100, plugin);
        }
        
        function initMenuWithoutScreenshotSupport(){
            var mnuFeedback = new ui.menu();
            menus.addItemByPath("Beta Feedback/", mnuFeedback, 10000, plugin);
            var parent = layout.findParent({name: 'help'});
            var item = menus.get("Beta Feedback").item;
            ui.insertByIndex(parent, item, 500, plugin);
            ui.insertByIndex(parent, new ui.divider({ 
                skin: "c9-divider-double", 
                "class" : "extrasdivider" 
            }), 810, plugin);

            item.$ext.addEventListener("click", function(e) { showFeedbackDialog(); });
            item.class = "betafeedback";
        }
        
        
        var drawn = false;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            _usersnapconfig = {
                apiKey: usApiKey,
                valign: "middle",
                halign: "right",
                tools: ["pen", "arrow", "note"],
                lang: "en",
                commentBox: true,
                commentBoxPlaceholder: "Enter any feedback here. What steps did"
                    + " you take? Is it reproducible in incognito mode?",
                emailBox: true,
                emailBoxPlaceholder: "Your email address",
                emailRequired: true,
                btnText: "Beta Feedback",
                beforeSend: function(obj) {
                    obj.addInfo = {
                        userAgent: navigator.userAgent
                    };
                },
                errorHandler: function(errorMessage, errorCode) { 
                    console.error("UserSnap Error Code: " + errorCode);
                    console.error("UserSnap Error Message: " + errorMessage); 
                },
                mode: "report"
            }; 
            (function() {
                var s = document.createElement("script");
                s.type = "text/javascript";
                s.async = true;
                s.src = "//api.usersnap.com/usersnap.js";
                var x = document.getElementsByTagName("head")[0];
                x.appendChild(s);
            })();

            // Create UI elements
            ui.insertMarkup(null, markup, plugin);
            
            win = plugin.getElement("feedbackDialog");
            form = plugin.getElement("form");
            confirmation = plugin.getElement("confirmation");
            btnSend = plugin.getElement("btnSend");
            btnClose = plugin.getElement("btnClose");
            description = plugin.getElement("description");
            confirmationMessage = plugin.getElement("confirmationMessage");
            
            btnClose.on("click", function(){ closeWindow(); });
            btnSend.on("click", function(){ fileTicket(); });

            emit("draw");
        }
        
        /***** Methods *****/
        
        function showFeedbackDialog() {
            draw();
            
            win.show();
        }

        function closeWindow() {
            win.hide();
            
            // Set the "Leave Beta feedback" form back to it's original state
            form.setProperty("visible", true);
            confirmation.setProperty("visible", false);
            btnSend.setAttribute("disabled", false);
            btnSend.show();
            btnClose.setCaption("Cancel");
            description.setValue("");
        }

        /**
         * fileTicket
         *
         * This function is called when pressing the Send button. It sends the contents
         * of the form to the Zendesk Cloud9 account, creating a support ticket
         * there.
         */
        function fileTicket() {
            btnSend.setAttribute("disabled", true);
            
            var userName = info.getUser().name;
            auth.request(baseurl + FILEFEEDBACK_URL, {
                method: "POST",
                timeout: 10000, 
                body: {
                    "feedback"    : description.getValue(),
                    "projectName" : c9.projectName,
                    "userAgent"   : navigator.userAgent,
                    "c9Version"   : c9.version,
                    "userName"   : userName
                },
                headers: {
                    "x-requested-with": "xmlhttprequest"
                },
                contentType: "application/x-www-form-urlencoded"
            }, function callback(err, data, res) {
                if (err) {
                    return alert("Error sending Beta feedback",
                        "Please email us at support@c9.io",
                        data);
                }
                
                // Show confirmation message
                confirmationMessage.setAttribute("caption",
                    "<center style='font-size: 14px; font-weight: bold'>Thanks"
                        + " for your Beta Feedback!</center>"
                );
                    
                form.setProperty("visible", false);
                confirmation.setProperty("visible", true);
                btnSend.hide();
                btnClose.setCaption("Close");
            });
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
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Renders the Feedback menu in the top menu bar.
         * @singleton
         **/
        plugin.freezePublicAPI({
            showFeedbackDialog: showFeedbackDialog
        });
        
        register(null, {
            feedback: plugin
        });
    }
});