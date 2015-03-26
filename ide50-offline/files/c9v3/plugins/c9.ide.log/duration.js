/**
 * Cloud9 Duration metrics
 *
 * @copyright 2013, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = ["Plugin", "c9", "log", "info", "tabManager"];
    main.provides = ["duration"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var info = imports.info;
        var tabs = imports.tabManager;
        var log = imports.log;

        var _ = require("lodash");

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit   = plugin.getEmitter();
        
        var durationStorage = {}; // logger storage
        
        // the interval & timer writing loggedIn stats to log storage;
        // Cloud9 stats assume every 60 seconds, so better not to deviate much 
        // from this, otherwise stats might be over- or undercounted
        var INTERVAL_LOG_LOGGED_IN_DURATION = 60000;
        var loggedInDurationTimer;
        // the interval & timer writing windowFocus stats to log storage, e.g. 30s
        var INTERVAL_LOG_WINDOW_FOCUSED_DURATION = 30000;
        var windowFocused = false; // whether window is focused or not
        var windowFocusDurationTimer;
        // the interval & timer writing tabFocus stats to log storage, e.g. 30s
        var INTERVAL_LOG_TAB_FOCUSED_DURATION = 30000;
        var tabFocusDurationTimer;
        // the timeout after which activity (e.g. keypress) is marked as done
        var TIMEOUT_ACTIVE_DURATION = 1000;
        
        var user; // The currently logged in User
        var workspace; // The currently used Workspace
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            
            info.getUser(function(err, usr) {
                user = usr;
                info.getWorkspace(function(err, ws) {
                    workspace = ws;
                    startLogging();
                });
            });
            
            function startLogging() {
                // register stats in the Log plugin so it can send them to the DWH
                // (this is a special plugin that does logging itself)
                log.registerLogger(plugin);
                
                measureLoggedInTime();
                measureIDEFocusTime();
                measureTabFocusTime();
                //measureActiveTime(); // disabled till we have time to test & optimize it
                
                loaded = true;
            }
        }

        /***** Methods *****/

        /**
         * Measure how long a user is logged in with the IDE.
         * 
         * This doesn't mean he's actually actively using the IDE, just that 
         * he's logged in.
         */
        function measureLoggedInTime() {
            clearInterval(loggedInDurationTimer);
            logStart("loggedIn");
            loggedInDurationTimer = setInterval(function() {
                logStart("loggedIn");
            }, INTERVAL_LOG_LOGGED_IN_DURATION);
            // no need to cancel it, happens automatically when user logs out
        }

        /**
         * Measure how long a user has the IDE browser pane/window focused.
         * 
         * This doesn't mean he's actually actively using the IDE, just that the 
         * IDE is focused on his screen.
         */
        function measureIDEFocusTime() {
            function onBlur() {
                windowFocused = false;
                // ensure measuring for any focused tabs is also stopped first, 
                // so its value doesn't exceed that of windowFocused
                onBlurTab({ tab: tabs.focussedTab });
                
                // send latest duration length to storage, then stop logging 
                clearInterval(windowFocusDurationTimer);
                windowFocusDurationTimer = null;
                logEnd("windowFocus", getFileType());
            }
            
            function onFocus() {
                windowFocused = true;
                clearInterval(windowFocusDurationTimer);
                logStart("windowFocus", getFileType());
                windowFocusDurationTimer = setInterval(function() {
                    logStart("windowFocus", getFileType());
                }, INTERVAL_LOG_WINDOW_FOCUSED_DURATION);
                
                // ensure any focused tabs are also measured now
                onFocusTab({ tab: tabs.focussedTab });
            }
         
            // HTML5 Visibility API: https://developer.mozilla.org/en-US/docs/Web/Guide/User_experience/Using_the_Page_Visibility_API
            var hidden, visibilityChange; 
            if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
                hidden = "hidden";
                visibilityChange = "visibilitychange";
            } else if (typeof document.mozHidden !== "undefined") {
                hidden = "mozHidden";
                visibilityChange = "mozvisibilitychange";
            } else if (typeof document.msHidden !== "undefined") {
                hidden = "msHidden";
                visibilityChange = "msvisibilitychange";
            } else if (typeof document.webkitHidden !== "undefined") {
                hidden = "webkitHidden";
                visibilityChange = "webkitvisibilitychange";
            }
            
            function handleVisibilityChange(e) {
                (document[hidden] || e.hidden) ? onBlur() : onFocus();
            }
            
            // Warn if the browser doesn't support addEventListener or the Page Visibility API
            if (typeof document.addEventListener === "undefined" || 
                typeof hidden === "undefined") {
                window.onpageshow = window.onfocus = document.onfocusin = onFocus;
                window.onpagehide = window.onblur = document.onfocusout = onBlur;
            } else {
                // Handle page visibility change   
                document.addEventListener(visibilityChange, handleVisibilityChange, false);
            }

            // start measuring focus duration from the time the IDE opens, 
            // but only if the window is actually focused!
            if (window.focused) 
                onFocus();
        }
        
        /**
         * Handles a file tab getting focus
         * @param {Object} e The event holding the tab
         */
        function onFocusTab(e) {
            // Only log if the window is focused, otherwise this can result 
            // in tabFocus > windowFocus, since tab focus events fire
            // regardless of whether window is focused; we'll ensure tab 
            // duration starts when window focuses in measureIDEFocusTime()
            if (windowFocused || window.focused) {
                clearInterval(tabFocusDurationTimer);
                logStart('tabFocus', getFileType(e.tab));
                tabFocusDurationTimer = setInterval(function() {
                    logStart("tabFocus", getFileType());
                }, INTERVAL_LOG_TAB_FOCUSED_DURATION);
            }
        }
        
        /**
         * Handles a file tab losing focus
         * @param {Object} e The event holding the tab
         */
        function onBlurTab(e) {
            clearInterval(tabFocusDurationTimer);
            tabFocusDurationTimer = null;
            logEnd('tabFocus', getFileType(e.tab));
        }
        
        /**
         * Measure how long a user has an IDE tab (e.g. file or Terminal) focused.
         * 
         * This doesn't mean he's actually actively using the tab, just that the 
         * tab is focused on his screen.
         */
        function measureTabFocusTime() {
            // handle user opening or switching (file) tabs
            tabs.on("focusSync", onFocusTab, plugin);
            tabs.on("blur", onBlurTab, plugin);
        }

        /**
         * Measure how long a user is actively using the IDE by doing things 
         * like moving his mouse, clicking, pressing keys, etcetera.
         * 
         * After TIMEOUT_ACTIVE_DURATION ms the activity is marked as done. 
         * Recommended to set this to a fairly low value (e.g. 1 second) for 
         * accuracy, but this is up to be played with :).
         */
        function measureActiveTime() {
            var activeTimeoutID;

            // set timer to write to log storage on TIMEOUT_ACTIVE_DURATION ms
            function startActiveTimer() {
                activeTimeoutID = setTimeout(function() {
                    logStart('active', getFileType());
                    activeTimeoutID = null;
                }, TIMEOUT_ACTIVE_DURATION);
            }
            
            // user just did something actively (e.g. keypress), decide 
            // to start timer or simply reset it
            function onActive() {
                if (!activeTimeoutID) {
                    // no activity timer running yet, start it
                    logStart('active', getFileType());
                    startActiveTimer();
                } else {
                    // timer already exists, so need to reset it and start again
                    clearTimeout(activeTimeoutID);
                    activeTimeoutID = null;
                    startActiveTimer();
                }
            }

            var timer;
            // bind all activity event such as keypress to onActive function
            document.addEventListener("mousedown", onActive, true);
            document.addEventListener("mouseup", onActive, true);
            document.addEventListener("click", onActive, true);
            document.addEventListener("dblclick", onActive, true);
            document.addEventListener('mousemove', function() {
                clearTimeout(timer);
                timer = setTimeout(onActive, 10);
            }, false);
            document.addEventListener('DOMMouseScroll', function() {
                clearTimeout(timer);
                timer = setTimeout(onActive, 10);
            }, false);
            document.addEventListener("keydown", onActive, true);
            document.addEventListener("keyup", onActive, true);
            document.addEventListener("keypress", onActive, true);
            // @TODO: needs to be tested on a touch device
            document.addEventListener("touchstart", onActive, true);
            
            // handle user opening or switching (file) tabs
            tabs.on("tabDestroy", function(e) {
                // log current activity duration and (re)start the timer
                logEnd('active', getFileType(e.tab));
                onActive();
            }, plugin);
            tabs.on("blur", function(e) {
                // log current activity duration
                logEnd('active', getFileType(e.tab));
            }, plugin);
        }

        function logStart(eventName, fileType) {
            var now = Date.now();

            // Fetch duration from the log plugin
            var storage = getDurationStorage();
            var event;
            
            // Retrieve the event if already recorded
            if (storage[eventName]) {
                event = storage[eventName];
            } 
            // Create a new event
            else {
                event = {
                    name: eventName,
                    workspaceId: workspace.id,
                    startTime: Date.now(),
                    lastTime: now,
                    totalTime: 0,
                    slots: []
                };
            }
            
            // Calculate time since last log
            var delta = now - (event.lastTime || now);
            
            // Add item to slots
            if (delta)
                addSlot(event, delta, fileType);
            
            // mark event as started
            delete event.stopped;
            
            // Update last log event time
            event.lastTime = now;
            event.lastFileType = fileType;
            
            // Write to storage
            storage[eventName] = event;
            emit("logStart", event);
        }
        
        function logEnd(eventName) {
            var now = Date.now();
            
            // Fetch duration from the log plugin
            var storage = getDurationStorage();
            
            // Retrieve the event if already recorded
            if (storage[eventName]) {
                var event = storage[eventName];
                // Push delta slots
                addSlot(event, now - event.lastTime, event.lastFileType);
                
                // Mark as stopped
                event.stopped = true;
                
                // Update last log event time
                event.lastTime = now;
                
                // Write to storage
                storage[eventName] = event;
                emit("logEnd", event);
            }
        }
        
        /**
         * Add a timeslot to a Duration event
         * @param {Object} event    The Duration event
         * @param {Number} delta    The duration of the slot
         * @param {String} fileType The file type for which the slot holds
         */
        function addSlot(event, delta, fileType){
            // Limit the delta to a little over the max for this type of 
            // duration, so we prevent anomalies in analytics
            if (event.name == "loggedIn" && delta > 
                (INTERVAL_LOG_LOGGED_IN_DURATION * 1.01)) {
                delta = INTERVAL_LOG_LOGGED_IN_DURATION;
            }
            else if (event.name == "windowFocus" && delta > 
                (INTERVAL_LOG_WINDOW_FOCUSED_DURATION * 1.01)) {
                delta = INTERVAL_LOG_WINDOW_FOCUSED_DURATION;
            }
            else if (event.name == "tabFocus" && delta > 
                (INTERVAL_LOG_TAB_FOCUSED_DURATION * 1.01)) {
                delta = INTERVAL_LOG_TAB_FOCUSED_DURATION;
            }
                
            if (event.stopped)
                delta = -1 * delta;
            
            // Push delta to slots
            if (fileType && delta > -1)
                event.slots.push([delta, fileType]);
            else
                event.slots.push([delta]);
            
            if (delta > 0) {
                // Add to total duration
                event.totalTime += delta;
                
                // Update fileType total time
                if (fileType && delta) {
                    if (!event.ftDur) event.ftDur = {};
                    event.ftDur[fileType] = (event.ftDur[fileType] || 0) + delta;
                }
            }
        }
        
        /**
         * Returns the current file type being used/viewed.
         * @param  {Function} tab   The tab to get the filetype from.
         * @return {String}         Current file extension, or a non-file (e.g. Terminal) prepended by "non-file: ".
         */
        function getFileType(tab) {
            // If no tab specified, try to get the current focused tab
            if (!tab)
                tab = tabs.focussedTab;
                
            // If there's no tab opened
            if (!tab || !tab.editor)
                return "none";
            
            if (!tab.path)
                return "!" + tab.editor.type;
            
            // also deal with files without extension
            var index = tab.path.lastIndexOf(".");
            return (index > -1) ? (tab.path.substr(index + 1)) : "!none";
        }
        
        function getDurationStorage() {
            return durationStorage;
        }
        
        function getAndClearStatsInMemory() {
            // loop through duration events, and only keep the ones that have 
            // just started; delete the rest because the logger will send them
            var d = {};
            for (var key in durationStorage) {
                var event = _.cloneDeep(durationStorage[key]);
                if (event.stopped && event.slots.length > 0) {
                    // add to events to return and clear from durationStorage
                    d[key] = event;
                    delete durationStorage[key];
                }
                else if (!event.stopped && event.slots.length > 0) {
                    // add to events and only have a slot/totalTime for the 
                    // delta, so it keeps on measuring
                    d[key] = event;
                    
                    var now = Date.now();
                    var delta = durationStorage[key].totalTime = now - 
                        durationStorage[key].lastTime;
                    durationStorage[key].slots = [[delta, 
                        durationStorage[key].lastFileType]];
                    durationStorage[key].totalTime = delta;
                    // set startTime to lastTime so event is sent to DWH with
                    // the right occurence time
                    durationStorage[key].startTime = 
                        durationStorage[key].lastTime;
                }
            }
            return d;
        }
        
        function getCategory() {
            return "duration";
        }
        
        function getUid() {
            return user.id;
        }

        /***** Testing *****/

        // for testing purposes
        function setLoggingIntervalForEvent(event, interval) {
            if (event == "loggedIn") {
                INTERVAL_LOG_LOGGED_IN_DURATION = interval;
                clearInterval(loggedInDurationTimer);
                loggedInDurationTimer = setInterval(function() {
                    logStart("loggedIn", getFileType());
                }, INTERVAL_LOG_LOGGED_IN_DURATION);
            }
            else if (event == "windowFocus") {
                INTERVAL_LOG_WINDOW_FOCUSED_DURATION = interval;
                clearInterval(windowFocusDurationTimer);
                windowFocusDurationTimer = setInterval(function() {
                    logStart("windowFocus", getFileType());
                }, INTERVAL_LOG_WINDOW_FOCUSED_DURATION);
            }
            else if (event == "tabFocus") {
                INTERVAL_LOG_TAB_FOCUSED_DURATION = interval;
                clearInterval(tabFocusDurationTimer);
                tabFocusDurationTimer = setInterval(function() {
                    logStart("tabFocus", getFileType());
                }, INTERVAL_LOG_TAB_FOCUSED_DURATION);
            }
        }
        
        // for testing purposes
        function clearDurationStorage() {
            durationStorage = {};
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });

        plugin.on("enable", function() {
        });

        plugin.on("disable", function() {
        });

        plugin.on("unload", function() {
            clearInterval(loggedInDurationTimer);
            clearInterval(windowFocusDurationTimer);
            clearInterval(tabFocusDurationTimer);
            loaded = false;
        });

        /***** Register and define API *****/

        /**
         * Logs duration metrics for the IDE on three levels:
         * 
         * 1. Logged In - How long the IDE is open in some window (user-level, workspace-level).
         * 2. Window/Tab Focused - How long the IDE is actively focused in a window/pane (user-level, workspace-level, filetype-level).
         * 3. Active - How long the IDE is actively being used by doing actions like moving the mouse or pressing keys (user-level, workspace-level, filetype-level).
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * Start logging for an event
             * @param {String} eventName The name of the event, e.g. 'windowFocus'
             * @param {String} fileType  The file type for which the event holds
             */
            logStart: logStart,
            
            /**
             * Stop logging for an event
             * @param {String} eventName The name of the event, e.g. 'windowFocus'
             */
            logEnd: logEnd,
            
            /** 
             * Get the stats in memory for Duration events.
             * Clears in memory stats for non-empty(!) Duration events 
             * after returning them.
             * Used by the Logger plugin to send all its stats to the DWH.
             * @return Object durationStorage for event 'duration'
             */
            getAndClearStatsInMemory   : getAndClearStatsInMemory,
            
            /** 
             * Get the category for this type of Logger
             * @return {String} the category for this Logger, e.g. "duration"
             */
            getCategory: getCategory,
            
            /** 
             * Get the UID for this Logger (there is one Duration logger per user)
             * @return {Number} the UID for the user
             */
            getUid: getUid,

            /**
             * Get the storage only for this logger ('duration').
             * Does not clear the stats
             * @return {Array}  log storage contents for logger 'duration'.
             */
            getDurationStorage: getDurationStorage,
            
            /**
             * Clear the local storage only for this logger ('duration').
             * Mostly used for testing.
             */
            clearDurationStorage: clearDurationStorage,
            
            /** 
             * Set the interval with which to log a certain event, e.g. 'loggedIn'
             * @param String event      The name of the event to set the interval for
             * @param Number interval   The interval to set in milliseconds
             */
            setLoggingIntervalForEvent: setLoggingIntervalForEvent,
        });

        register(null, {
            duration: plugin
        });
    }
});