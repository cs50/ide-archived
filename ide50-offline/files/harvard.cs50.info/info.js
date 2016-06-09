define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "menus", "settings", "layout", "Dialog",
        "proc", "preferences", "collab.workspace", "api", "c9", "console"
    ];
    main.provides = ["cs50.info"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var menus = imports.menus;
        var commands = imports.commands;
        var layout = imports.layout;
        var Dialog = imports.Dialog;
        var proc = imports.proc;
        var settings = imports.settings;
        var prefs = imports.preferences;
        var api = imports.api;
        var c9 = imports.c9;
        var workspace = imports["collab.workspace"];

        /***** Initialization *****/

        var plugin = new Dialog("CS50", main.consumes, {
            allowClose: true,
            modal: true,
            textselect: true,
            title: "Services"
        });

        var infoBtn, versionBtn;   // UI button

        var RUN_MESSAGE = "It's time to run <tt>update50</tt>!"; // update50 message
        var DEFAULT_REFRESH = 30;   // default refresh rate
        var delay;                  // current refresh rate
        var fetching;               // are we fetching data
        var html = null;            // object with references to html els
        var showing;                // is the dialog showing
        var stats = null;           // last recorded stats
        var timer = null;           // javascript interval ID
        var domain = null;          // current domain

        function load() {
            showing = false;
            fetching = false;

            // notify the instance of the domain the IDE is loaded on
            domain = window.location.hostname;

            // we only want the domain; e.g., "cs50.io" from "ide.cs50.io"
            if (domain.substring(0, 3) == "ide")
                domain = domain.substring(4);

            // set default values
            settings.on("read", function(){
                settings.setDefaults("user/cs50/info", [
                    ["refreshRate", DEFAULT_REFRESH]
                ]);

                settings.setDefaults("project/cs50/info", [
                    ["public", false]
                ]);
            });

            // watch for settings change and update accordingly
            settings.on("write", function() {
                // if theme changes, update dialog background color
                if (html != null)
                    setBackgroundColor(html.stats.parentElement);

                // fetch new rate, stopping timer to allow restart with new val
                var rate = settings.getNumber("user/cs50/info/@refreshRate");

                if (delay != rate) {
                    // validate new rate, overwriting bad value if necessary
                    if (rate < 1) {
                        delay = DEFAULT_REFRESH;
                        settings.set("user/cs50/info/@refreshRate", delay);
                    } else {
                        delay = rate;
                    }

                    // update stats and timer interval
                    updateStats();
                    stopTimer();
                    startTimer();
                }
            });

            // fetch setting information
            delay = settings.getNumber("user/cs50/info/@refreshRate");

            // notify UI of the function to run to open the dialog
            commands.addCommand({
                name: "cs50infoDialog",
                hint: "CS50 IDE Info Window",
                group: "General",
                exec: toggle
            }, plugin);

            /* TODO: decide if wanted
            // 
            commands.addCommand({
                name: "update50",
                group: "General",
                exec: update50
            }, plugin);
            */

            // notify UI of the function to open the host in a new tab
            commands.addCommand({
                name: "openDomain",
                hint: "CS50 IDE Host",
                group: "General",
                exec: loadHost
            }, plugin);

            // add a menu item to show the dialog
            menus.addItemByPath("Window/~", new ui.divider(), 33, plugin);
            menus.addItemByPath("Window/CS50 IDE Info...", new ui.item({
                command: "cs50infoDialog"
            }), 34, plugin);

            // load CSS for button
            imports.ui.insertCss(require('text!./style.css'), options.staticPrefix, plugin);

            // create CS50 button
            infoBtn = new ui.button({
                command: "cs50infoDialog",
                skin: "c9-menu-btn",
                tooltip: "Services",
                visible: true
            });

            // place CS50 button
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), infoBtn, 860, plugin);

            // globe
            // TODO: change to http://glyphicons.com/, &#xe371, <span class="glyphicons glyphicons-globe-af"></span>
            infoBtn.$ext.innerHTML = "&#127760;";

            // create version button
            versionBtn = new ui.button({
                skin: "c9-menu-btn",
                visible: false
            });
            versionBtn.setAttribute('class', 'cs50-info-version');

            // place version button
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), versionBtn, 860, plugin);

            // Add preference pane
            prefs.add({
               "CS50" : {
                    position: 5,
                    "IDE Information" : {
                        position: 10,
                        "Information refresh rate (in seconds)" : {
                            type: "spinner",
                            path: "user/cs50/info/@refreshRate",
                            min: 1,
                            max: 200,
                            position: 200
                        }
                    }
                }
            }, plugin);

            // fetch data
            updateStats();

            // always verbose, start timer
            startTimer();
        }

        /*
         * Stop automatic refresh of information by disabling JS timer
         */
        function stopTimer() {
            if (timer == null) return;
            window.clearInterval(timer);
            timer = null;
        }

        /*
         * If not already started, begin a timer to automatically refresh data
         */
        function startTimer() {
            if (timer != null) return;
            timer = window.setInterval(updateStats, delay * 1000);
        }

        /*
         * Updates the shared status (public or private).
         */
        function fetchSharedStatus() {
            api.project.get("", function(err, data) {
                if (err || workspace.myUserId != data.owner.id)
                    return;

                settings.set("project/cs50/info/@public",
                    data["visibility"] == "public" ||
                    data["appAccess"] == "public");
            });
        }

        /*
         * Initiate an info refresh by calling `info50`
         */
        function updateStats(callback) {
            // respect the lock
            if (fetching) return;

            fetching = true;

            // check for shared state
            if (c9.hosted) fetchSharedStatus();

            // hash that uniquely determines this client
            var myID = workspace.myUserId;
            var myClientID = workspace.myClientId;
            var hash = myID + '-' + myClientID;

            // extra buffer time for info50
            // refer to info50 for more documentation on this
            var buffer = delay + 2;

            proc.execFile("info50", {
                args: [domain, hash, buffer],
                cwd: "/home/ubuntu/workspace"
            }, parseStats);
        }

        /*
         * Process output from info50 and update UI with new info
         */
        function parseStats(err, stdout, stderr) {
            // release lock
            fetching = false;

            if (err) {
                var long;
                if (err.code == "EDISCONNECT") {
                    // disconnected client: don't provide error
                    return;
                }
                else if (err.code == "ENOENT") {
                    // command not found
                    long = RUN_MESSAGE;
                }
                else {
                    long = "Unknown error from workspace: <em>" + err.message +
                           " (" + err.code + ")</em><br /><br />"+ RUN_MESSAGE;
                }

                // notify user through button text
                versionBtn.$ext.innerHTML = RUN_MESSAGE;

                // update dialog with error
                stats = {"error":long};
                updateDialog();
                return;
            }

            // parse the JSON returned by info50 output
            stats = JSON.parse(stdout);

            // update UI
            versionBtn.setCaption(stats.version);
            versionBtn.show();
            updateDialog();
        }

        /*
         * Update the Dialog text based on latest info50
         */
        function updateDialog() {
            // confirm dialog elements have been created
            if (html == null) return;

            if (stats == null) {
                // no information fetched yet
                html.info.innerHTML = "Please wait, fetching information...";
                html.info.style.display = "block";
                html.stats.style.display = "none";
            }
            else if (stats.hasOwnProperty("error")) {
                // error while fetching information
                html.info.innerHTML = stats.error;
                html.info.style.display = "block";
                html.stats.style.display = "none";
            }
            else {

                // TODO: just fill modal with RUN_MESSAGE rather than per field

                // have stats: update table of info in dialog window
                html.info.style.display = "none";
                html.stats.style.display = "block";

                // Add MySQL username and password field
                if (stats.hasOwnProperty("user")) {
                    html.user.innerHTML = stats.user;
                }
                else {
                    html.user.innerHTML = RUN_MESSAGE;
                }
                if (stats.hasOwnProperty("passwd")) {
                    html.passwd.innerHTML = stats.passwd;
                }
                else {
                    html.passwd.innerHTML = RUN_MESSAGE;
                }

                html.hostname.innerHTML = '<a href="//'+ stats.host +
                    '/" target="_blank">' + location.protocol + "//" +
                    stats.host + '/</a>';

                var pma = stats.host + '/phpmyadmin';
                html.phpmyadmin.innerHTML = '<a href="//' + pma +
                    '/" target="_blank">' + location.protocol + "//" + pma +
                    '/</a>';
            }
        }

        /*
         * Toggle the display of the stats dialog
         */
        function toggle() {
            if (showing) {
                plugin.hide();
            }
            else {
                plugin.show();
            }
        }

        /*
         * Opens terminal within console and runs update50 therein.
         */
        /* TODO: decide if wanted
        function update50() {
            imports.console.openEditor("terminal", true, function(err, tab) {
                if (!err) {
                    tab.editor.on("draw", function(e) {
                        tab.editor.write("update50\n");
                    });
                }
            });
        }
        */

        /*
         * Open domain page in new tab
         */
        function loadHost() {
            window.open("//" + stats.host);
        }

        /*
         * Checks if user can preview local server
         */
        function canPreview() {
            if (!c9.hosted) return true;

            if (settings.getBool("project/cs50/info/@public")) return true;

            // remove port from domain if present
            if (!stats || typeof stats.host !== "string") return false;

            var host = stats.host.split(":", 1)[0];

            // host must match, except c9 IDEs must be on c9users domain
            return (domain == "c9.io" && host.endsWith("c9users.io")) ||
                    host.endsWith(domain);
        }

        /*
         * Set the background color of the dialog based on the theme
         */
        function setBackgroundColor(html) {
            var bgcolor;
            switch (settings.get("user/general/@skin")) {
                case "flat-light":
                    bgcolor = "#FEFEFE";
                    break;
                case "flat-dark":
                    bgcolor = "#222222";
                    break;
                default:
                    bgcolor = "#DEDEDE";
            }
            html.style.setProperty("background-color", bgcolor);
        }


        /*
         * Place initial HTML on the first drawing of the dialog
         */
        plugin.on("draw", function(e) {

            e.html.innerHTML =
                '<p id="info">...</p>' +
                '<table id="stats"><col width="110">' +
                '<tr><td><strong>Web Server</strong></td><td id="hostname">...</td></tr>' +
                '<tr><td><strong>phpMyAdmin</strong></td><td id="phpmyadmin">...</td></tr>' +
                '<tr><td><strong>MySQL Username</strong></td><td id="user">...</td></tr>' +
                '<tr><td><strong>MySQL Password</strong></td><td id="passwd">...</td></tr>' +
                '</table>';

            // Prevents column wrapping in any instance
            e.html.style.whiteSpace = "nowrap";

            // Sets background on initial draw to prevent unecessary flicker
            setBackgroundColor(e.html);

            // find & connect to all of the following in the dialog's DOM
            var els = ["version", "hostname", "phpmyadmin", "info",
                       "stats", "user", "passwd"];
            html = {};
            for (var i = 0, j = els.length; i < j; i++)
                html[els[i]] = e.html.querySelector("#" + els[i]);

            updateDialog();
        });

        /*
         * When the dialog is shown, request latest info and display dialog
         */
        plugin.on("show", function () {
            showing = true;

            // make sure dialog has latest info
            updateStats();

            // keep dialog up-to-date
            startTimer();
        });

        /*
         * When dialog is hidden, reset state, stopping the timer if necessary
         */
        plugin.on("hide", function () {
            startTimer();
            showing = false;
        });

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });

        plugin.on("unload", function() {
            stopTimer();

            delay = 30;
            timer = null;
            showing = false;
            infoBtn = null;
            versionBtn = null;
            fetching = false;
            html = null;
            stats = null;
            domain = null;
        });

        /***** Register and define API *****/

        /**
         * This is an example of an implementation of a plugin.
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * @property showing whether this plugin is being shown
             */
            get showing(){ return showing; },

            /**
             * @property showing whether this client can preview
             */
            get canPreview(){ return canPreview(); },

            /**
             * @property showing hostname50
             */
            get host() { return (stats && stats.hasOwnProperty("host")) ? stats.host : null; },

            /**
             * @property showing whether info50 has run at least once
             */
            get hasLoaded(){ return (stats != null); },

            _events: [
                /**
                 * @event show The plugin is shown
                 */
                "show",

                /**
                 * @event hide The plugin is hidden
                 */
                "hide"
            ],

            /**
             * Show the plugin
             */
            show: plugin.show,

            /**
             * Hide the plugin
             */
            hide: plugin.hide,
        });

        register(null, {
            "cs50.info": plugin
        });
    }
});
