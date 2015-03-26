/**
 * Access control dialogs
 */
define(function(require, exports, module) {
"use strict";

    main.consumes = [
        "Plugin", "api", "dialog.alert", "dialog.question",
        "ui", "layout", "commands", "dialog.notification"
    ];
    main.provides = ["accessControl"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var api = imports.api;
        var showAlert = imports["dialog.alert"].show;
        var showQuestion = imports["dialog.question"].show;
        var notify = imports["dialog.notification"].show;
        var ui = imports.ui;
        var layout = imports.layout;
        var commands = imports.commands;

        var plugin = new Plugin("Ajax.org", main.consumes);
        var readonly = options.readonly;
        var dashboardUrl = options.dashboardUrl;
        var lastInfo = {};

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;
            
            if (!readonly)
                return;

            api.collab.get("access_info", function (err, info) {
                if (err) return showAlert("Error", info);
                
                lastInfo = info;

                if (info.private) {
                    if (!info.member) {
                        // Do you want to request access to this workspace
                        showRequestAccessDialog();
                    }
                    else if (info.pending) {
                        // Already requested, do you want to cancel ?
                        showCancelAccessDialog();
                    }
                }
                else {
                    addRequestButton();
                    
                    if (!info.member || info.pending) {
                        notify("<div class='c9-readonly'>You are in Read-Only Mode. "
                            + (info.pending ? "" : "Click on this bar to request access from the owner.")
                            + "</div>", true);
                        
                        if (!info.pending) {
                            document.querySelector(".c9-readonly").addEventListener("click", function(){
                                showRequestAccessDialog();
                            }, false);
                        }
                    }
                }
                
            });
        }
        
        function addRequestButton() {
            var btn = new ui.button({
                skin: "c9-menu-btn",
                caption: "Request Access",
                tooltip: "Request Write Access",
                command: "request_access"
            });

            commands.addCommand({
                name: "request_access",
                hint: "Share the workspace",
                group: "General",
                exec: showRequestAccessDialog
            }, plugin);

            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), btn, 600, plugin);
        }

        function showRequestAccessDialog(write) {
            if (lastInfo.pending)
                return showCancelAccessDialog();
            
            showQuestion("Workspace Access",
              "You don't currently have " + (write ? "write " : "")
              + "access to this workspace",
              "Would you like to request access?",
              function(){
                  // Yes
                 requestAccess();
                 lastInfo.pending = true;
              },
              redirectToDashboardIfPrivate
            );
        }
        
        function requestAccess() {
             api.collab.post("request_access", function (err, member) {
                 if (err) return showAlert("Error Requesting access", err.message || err);
                 showAlert("Done", "Access request sent", "We have sent an access request to the admin of this workspace.");
             });
        }

        function showCancelAccessDialog() {
            showQuestion("Workspace Access",
              "Request access pending approval",
              "Would you like to cancel your access request?",
              function(){
                  // Yes
                  api.collab.delete("cancel_request", function (err) {
                      if (err) return showAlert("Error", err);
                      lastInfo.pending = false;
                      showAlert("Done", "Access request cancelled", "We don't currently have access to this workspace");
                  });
              },
              redirectToDashboardIfPrivate
            );
        }

        function redirectToDashboardIfPrivate() {
            if (lastInfo.private)
                window.top.location.href = dashboardUrl;
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
        });

        plugin.freezePublicAPI({
            requestAccess: requestAccess,
            
            showRequestAccessDialog: showRequestAccessDialog
        });

        register(null, {
            accessControl: plugin
        });
    }
});