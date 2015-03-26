define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "ui", "vfs.endpoint", "vfs", "layout", "anims"
    ];
    main.provides = ["restore"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var vfs = imports.vfs;
        var anims = imports.anims;
        var endpoint = imports["vfs.endpoint"];
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var el, msgEl, detailsEl, descriptionEl, uiProgress, uiLabel;

        var STATE_MIGRATING = 4;
        var STATE_MARKED_FOR_ARCHIVE = 20;
        var STATE_ARCHIVING = 21;
        var STATE_ARCHIVED = 22;
        var STATE_MARKED_FOR_RESTORE = 23;
        var STATE_RESTORING = 24;
        var STATE_RESIZING = 31;

        var stateMessages = {};
        stateMessages[STATE_MIGRATING] = "Migrating your workspace to our new backend";
        stateMessages[STATE_MARKED_FOR_ARCHIVE] =
        stateMessages[STATE_ARCHIVING] = "Archiving your workspace";
        stateMessages[STATE_ARCHIVED] =
        stateMessages[STATE_MARKED_FOR_RESTORE] =
        stateMessages[STATE_RESTORING] = "Waking up your workspace from hibernation.";
        stateMessages[STATE_RESIZING] = "Resizing your workspace";
        var premiumState = "Moving your workspace to a new server";
        
        var description = 
            "<strong>What's going on here?</strong>\n" +
            "<p>\n" +
            "Cloud9 creates a separate virtual machine for each workspace. \n" +
            "In order to provide a free\n" +
            "service for everyone, we hibernate workspaces of\n" +
            "<nobr>non-premium</nobr> users after about one week of inactivity.\n" +
            "This is because the virtual machines constantly use resources even if\n" +
            "the workspace is not actively used.\n" +
            "<p>\n" +
            "Please wait a moment while we wake up your workspace. It will\n" +
            "be just as you left it.\n" +
            "<p>\n" +
            "<a href='" + options.ideBaseUrl + "/dashboard.html?upgrade' target='_blank'>Upgrade to premium</a> to make sure your workspace never \n" +
            "goes into hibernate.\n";
            
        var migrateDescription = 
            "<strong>What's going on here?</strong>\n" +
            "<p>\n" +
            "We rolled out a completely new backend infrastructure with \n" +
            "improved performance and lots of new features.\n" +
            "<p>\n" +
            "With the new backend you get:\n" +
            "<ui>\n" +
            "<li>an Ubuntu VM</li>\n" +
            "<li>root access using sudo</li>\n" +
            "<li>ability to run services</li>\n" +
            "<li>ability to install packages</li>\n" +
            "</ul>\n" +
            "<p>\n" +
            "Please wait a moment while we move your workspace. It will\n" +
            "be just as you left it.\n";
        
        var premiumDescription =
            "<strong>What's going on here?</strong>\n" +
            "<p>\n" +
            "We're migrating your premium workspace to a new server \n" +
            "to ensure optimal performance.\n" +
            "<p>\n" +
            "Please wait a moment while we move your workspace. It will\n" +
            "be just as you left it.\n";
            
        var resizeDescription =
            "<strong>What's going on here?</strong>\n" +
            "<p>\n" +
            "We're resizing your workspace disk and ram \n" +
            "to be exactly as you specified.\n" +
            "<p>\n" +
            "Please wait a moment while we resize your workspace. It will\n" +
            "be just as you left it.\n";

        var stateDescriptions = {};
        stateDescriptions[STATE_MIGRATING] = migrateDescription;
        stateDescriptions[STATE_MARKED_FOR_ARCHIVE] = description;
        stateDescriptions[STATE_ARCHIVING] = description;
        stateDescriptions[STATE_ARCHIVED] = description;
        stateDescriptions[STATE_MARKED_FOR_RESTORE] = description;
        stateDescriptions[STATE_RESTORING] = description;
        stateDescriptions[STATE_RESIZING] = resizeDescription;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            endpoint.on("restore", showRestore);
            vfs.on("connect", hideRestore);
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return false;
            drawn = true;
            
            ui.insertCss(require("text!./restore.css"), plugin);
            ui.insertHtml(null, require("text!./restore.html"), plugin);
            
            el = document.getElementById("c9_ide_restore");
            msgEl = document.querySelector("#c9_ide_restore .loading-msg");
            detailsEl = document.querySelector("#c9_ide_restore .loading-details");
            descriptionEl = document.querySelector("#c9_ide_restore .paper");
            uiProgress = document.querySelector("#progress_bar .ui-progress");
            uiLabel = document.querySelector("#progress_bar .ui-label");
        }
        
        /***** Methods *****/
        
        var progress, maxProgress, run = 0;
        
        function animateProgress(progress, callback) {
            anims.animate(uiProgress, {
                width: progress + "%",
                timingFunction: "cubic-bezier(.02, .01, .47, 1)",
                duration: "1s"
            }, callback);
            
            if (Math.ceil(progress) < 13)
                uiLabel.style.display = "none";
            else if (uiLabel.style.display == "none") {
                uiLabel.style.opacity = 0;
                anims.animate(uiLabel, { opacity: 1, duration: "1s" }, function(){
                    uiLabel.style.display = "block";
                });
            }
            
            if (progress >= 100) {
                uiLabel.innerHTML = "Completed";
                setTimeout(function() {
                    anims.animate(uiLabel, { opacity: 0, duration: "1s" }, function(){
                        uiLabel.style.display = "none";
                    });
                }, 1000);
            } else {
                uiLabel.innerHTML = Math.floor(progress) + "%";
            }
        }
        
        function walk(loopId) {
            if (loopId != run) return;
            
            if (progress > 100)
                return;
                
            if (progress > maxProgress)
                return setTimeout(walk.bind(null, loopId), 500);
            
            animateProgress(progress++, function(){ 
                setTimeout(walk.bind(null, loopId), 10); 
            });
        }
        
        function showRestore(state) {
            draw();
            
            if (el.style.display != "block") {
                uiProgress.style.width = 0;
                progress = 6;
                maxProgress = 10;
            }
            
            if (state.premium && state.projectState !== STATE_MIGRATING) {
                msgEl.innerText = premiumState;
                descriptionEl.innerHTML = premiumDescription;
            }
            else {
                msgEl.innerText = stateMessages[state.projectState || STATE_ARCHIVED];
                descriptionEl.innerHTML = stateDescriptions[state.projectState || STATE_ARCHIVED];
            }
            
            // we did not receive JSON
            if (!state.progress)
                state.progress = { progress: 100, nextProgress: 100, state: 2 };
            
            // Display Message to the User
            detailsEl.innerText = state.progress.message || "";
                
            // Update Progress Bar
            maxProgress = Math.max(maxProgress, state.progress.nextProgress);
            progress = Math.max(progress, state.progress.progress);
            
            walk(++run);
            
            // Show Restore Screen
            el.style.display = "block";
        }
        
        function hideRestore() {
            if (el) 
                el.style.display = "none";
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });

        /***** Register and define API *****/

        /**
         * 
         **/
        plugin.freezePublicAPI({
            show: showRestore,
            hide: hideRestore
        });
        
        register(null, { "restore" : plugin });
    }
});