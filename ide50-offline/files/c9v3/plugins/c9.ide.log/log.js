/**
 * Cloud9 Logging: Logs & Metrics
 *
 * @copyright 2013, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "ext", "api", "info", "c9.analytics"];
    main.provides = ["log"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var info = imports.info;
        var analytics = imports["c9.analytics"];
        var devel = options.devel;
        var source = options.source || "web"; // the default "source", e.g. "Web" or "Desktop"
        var assert = require("assert");

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit   = plugin.getEmitter();
        
        var testing = false;
        
        // holds the loggers that track stats themselves; the Log plugin needs 
        // to know about them, so it can write their stats to the Metric server
        // format: {Object} logger, stat.uid, stat.workspaceId
        var registeredLoggers = [];

        var INTERVAL_WRITE_TO_DWH = 60000; // default interval writing to DWH; 60s is generally right
        var currIntervalWriteToDWH = INTERVAL_WRITE_TO_DWH; // the current interval writing to DWH (so not the default)
        var writeToDWH; // timer for writing logStorage stats to the DWH
        var MAX_LOCAL_STORAGE_SIZE = 1024 * 4; // maximum localStorage size in KB, e.g. 4096KB
        var MESSAGE_SENDING_WINDOW_TIME = 5000;
        var MESSAGE_SENDING_WINDOW_AMOUNT = 10;

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;
            
            // do not log stats in devel mode
            if (devel)
                return;
            
            logRegisteredStats(INTERVAL_WRITE_TO_DWH);

            /***** Connection handling ******/

            c9.on("stateChange", function(e) {
                if (!c9.has(c9.NETWORK)) {
                    // write every 30 mins to not block UI thread too often
                    setIntervalWriteToDWH(30 * INTERVAL_WRITE_TO_DWH);
                }
                if (c9.has(c9.NETWORK)) {
                    // connection has returned, write whatever was buffered in
                    // localStorage to the stats API
                    writeLocalStorageStatsToDWH();
                    setIntervalWriteToDWH(INTERVAL_WRITE_TO_DWH);
                }
            });

            c9.on("beforequit", function(e) {
                // write stats to DWH before quitting
                writeLocalStorageStatsToDWH();
            });
        }
        
        /***** Methods *****/
        
        function logEvent(name, uid, params, callback) {
            if (typeof uid === "function")
                return logEvent(name, null, {}, uid);
            if (typeof params === "function")
                return logEvent(name, uid, {}, params);
            if (typeof uid === "object")
                return logEvent(name, null, uid, callback);
            if (!uid)
                uid = info.getUser().id;
            
            if (isNaN(uid))
                return callback && callback("User ID NaN, type is: " + typeof uid);
            if (Object.prototype.toString.call(params || {}) !== '[object Object]')
                return callback && callback("Specified params variable is not an object");
                
            var metric = {
                source: source,
                c9_version  : c9.version,
                type: "event",
                name: name,
                uid: uid,
                params: params || {},
                ts: Date.now()
            };
            logMessage(metric, function(err, result) {
                if (err)
                    return callback && callback("Couldn't send metric (" 
                        + JSON.stringify(metric) + "): ", err);

                return callback && callback(null, result);
            });
        }

        function logMetric(type, name, uid, params, callback) {
            if (isNaN(uid))
                return callback("User ID NaN, type is: " + typeof uid);
            if (Object.prototype.toString.call(params) !== '[object Object]')
                return callback("Specified params variable is not an object");

            var metric = {
                source: source,
                c9_version: c9.version,
                type: type,
                name: name,
                uid: uid,
                params: params,
                ts: new Date().getTime()
            };
            logMessage(metric, function(err) {
                if (err) {
                    console.error(err);
                    return callback("Couldn't send metric (" 
                        + JSON.stringify(metric) + "): ", err);
                }
            });
            return callback(null);
        }

        /**
         * Simply logs a message to the remote VFS plugin.
         * This is used to log a fully formatted metric to the DWH, 
         * where it is formatted by other functions such as logEvent()
         * @param {String}   message        The message to log (a JSON object).
         * @param {Function} callback       Called when the message is logged.
         * @param {Error}    callback.err   The error information returned.
         * @param {String}   callback.data  Optional message about the status.
         */
        function logMessage(message, callback) {
            logMessages([message], callback);
        }
        
        /**
         * Logs an array of messages to the remote VFS plugin.
         * This is used to log fully formatted metrics to the DWH, 
         * where it is formatted by other functions such as logEvent()
         * @param {Array}    messages       The messages to log (array of JSON objects).
         * @param {Function} callback       Called when the messages are logged.
         * @param {Error}    callback.err   The error information returned.
         * @param {String}   callback.data  Optional message about the status.
         */
        function logMessages(messages, callback) {
            // do not log stats in devel mode
            if (devel)
                return callback();
            if (!c9.has(c9.NETWORK)) {
                // connection is not available, buffer in localStorage
                var currLogStorage = localStorage.getItem('logMessages') || "";
                var arr = [];
                if (currLogStorage !== "") {
                    arr = JSON.parse(currLogStorage);
                }
                arr = arr.concat(messages);
                try {
                    localStorage.setItem('logMessages', JSON.stringify(arr));
                }
                catch (e) {
                    // trim it and try adding the message again
                    arr = trimLocalStorageSize();
                    arr = arr.concat(messages);
                    try {
                        localStorage.setItem('logMessages', JSON.stringify(arr));
                    } catch(e) {
                        // out of quota
                    }
                }
                // if localStorage still too big according to set limit, trim it
                var lsSize = JSON.stringify(localStorage).length / 1024;
                if (lsSize >= MAX_LOCAL_STORAGE_SIZE) {
                    trimLocalStorageSize();
                }
                emit("loggedToLocalStorage", messages);
                return callback(null, "No connection; log message stored");
            } else {
                if (!messages || messages.length === 0)
                    return;
                
                // only send max 10 messages in a short time (5 seconds)
                var ltmss = 0;
                if (messagesSentWindow.length > 0)
                    ltmss = Date.now() - Math.min.apply(Math, messagesSentWindow);
                if (ltmss < MESSAGE_SENDING_WINDOW_TIME && 
                    messagesSentWindow.length >= MESSAGE_SENDING_WINDOW_AMOUNT) {
                    // buffer and retry later
                    messageBuffer = messageBuffer.concat(messages);
                    clearTimeout(messageTimer);
                    messageTimer = setTimeout(sendMessageBuffer, 
                        MESSAGE_SENDING_WINDOW_TIME - ltmss);
                    emit("bufferedMessages", messageBuffer);
                } else {
                    // get first element from stack and track it
                    var message = messages.shift();
                    if (!testing) {
                        analytics.track(message.name, message, {
                            integrations: {
                                "All": false,
                                "DWH": true
                            },
                            tdTable: "duration_logs"
                        });
                    }
                    emit("loggedToDWH", message);
                    messagesSentWindow.push(Date.now()); 
                    
                    //remove messages from window that have been sent >5s ago
                    for(var i = 0; i < messagesSentWindow.length; i++) {
                        if (messagesSentWindow[i] && messagesSentWindow[i] < 
                            (Date.now() - MESSAGE_SENDING_WINDOW_TIME))
                            messagesSentWindow.shift();
                    }
                    
                    if (messages.length > 0)
                        logMessages(messages, callback);
                    else
                        callback(null);
                }
            }
        }

        var messageBuffer = []; // holds any messages that could not be sent
        var messageTimer; // timer for backing off to resend messages
        var messagesSentWindow = []; // sliding window for when messages were sent
        function sendMessageBuffer() {
            // let logMessages() deal with any errors, just clear buffer
            logMessages(messageBuffer, function(err, result) {});
            messageBuffer = [];
            emit("messageBufferCleared", messageBuffer);
        }

        /**
         * Formats & logs a special type of event, Duration, to the DWH
         * @param {Object} event        The Duration event
         * @param {Number} uid          The User ID
         * @param {Function} callback   Called when all metrics are sent
         *  
         */
        function logDurationEvent(event, uid, callback) {
            if (!event.name)
                return callback("Event name not set");
            if (Object.prototype.toString.call(event.slots) !== '[object Array]')
                return callback("Specified event.slots variable is not an array");
            if (event.slots.length === 0)
                return callback("No slots to send (yet)");
            if (isNaN(uid))
                return callback("User ID NaN, type is: " + typeof uid);
            
            // loop through event slots to send duration for each filetype
            // durationSlots look like: [[13, js], [-10], [11,php], [14,js]]
            // resulting events should be: 
            //      uid | windowFocus | js | timestamp | 13
            //      uid | windowFocus | none | timestamp + 13 | 10
            //      uid | windowFocus | php | timestamp + 13 + 10 | 11
            var startTime = event.startTime;
            var processedDuration = 0;
            var events = [];
            for (var i = 0; i < event.slots.length; i++) {
                var slot = event.slots[i]; // [duration, filetype]
                var duration = Math.abs(slot[0]);
                var fileType = "none";
                if (slot[1])
                    fileType = slot[1];
                
                var e = {
                    source      : source,
                    c9_version  : c9.version,
                    type        : "duration",
                    uid         : uid,
                    workspace_id: event.workspaceId, 
                    name        : event.name,
                    file_type   : fileType,
                    start_time  : startTime + processedDuration,
                    duration    : duration
                };
                events.push(e);

                // add processed duration for calculation of timeslot start time
                processedDuration += duration;
            }
            
            // asynchronously send the events to log to Metric server
            logMessages(events, callback);
        }

        /**
         * Stream each entry in the logger's memory to the DWH
         * @param {Object} logger   The logger that needs streaming
         */
        function writeStatsInMemoryToDWH(stats, uid, category) {
            if (!stats || Object.keys(stats).length === 0)
                return;

            // fake 'pop' below: get first element and remove it from the stack
            var event = stats[Object.keys(stats)[0]];
            
            if (category == "duration" && event) {
                logDurationEvent(event, uid, function(err, result) {
                    if (err)
                        return console.error("Couldn't log/send " + event.name
                            + " event: ", err);
                });
            }
            else {
                logEvent(event.name, uid, event.params, function(err, result) {
                    if (err)
                        return console.error("Couldn't log/send " + event.name
                            + " event: " + err);
                });
            }
            // event should be sent, now remove from storage
            delete stats[Object.keys(stats)[0]];
            
            if (Object.keys(stats).length > 0)
                writeStatsInMemoryToDWH(stats, uid, category);
        }
        
        /**
         * Regulary sends registered stats by other plugins to the DWH
         * @param {Number} interval The interval with which to write to the DWH
         */
        function logRegisteredStats(interval) {
            clearInterval(writeToDWH);
            writeToDWH = setInterval(function() {
                // for each logger that needs to be logged, start processing
                for (var i = 0; i < registeredLoggers.length; i++) {
                    var logger = registeredLoggers[i].logger;
                    writeStatsInMemoryToDWH(logger.getAndClearStatsInMemory(), 
                        logger.getUid(), logger.getCategory());
                }
            }, interval);
        }

        /**
         * Writes LocalStorage stats to the DWH, e.g. on reconnect
         */
        function writeLocalStorageStatsToDWH() {
            try {
                var logMessages = localStorage.getItem('logMessages');
                var storage = JSON.parse(logMessages);
            } catch(e) {
                storage = [];
            }
            if (storage) {
                var storageLength = storage.length;
                var i = 0;
                storage.forEach(function(entry) {
                    i++;
                    // when done, clear the logStore
                    if (i == storageLength) {
                        try {
                            localStorage.setItem('logMessages', "[]");
                        } catch(e) {}
                    }
                        
                    logMessage(entry, function(err, result) {
                        if (err)
                            console.error("Error sending log in localStorage: ", 
                                entry);
                    });
                });
            }
        }

        /**
         * Truncates localStorage it if it's grown too big
         */
        function trimLocalStorageSize() {
            var logMessages = localStorage.getItem('logMessages');
            var storage = JSON.parse(logMessages);
            if (storage) {
                // remove 25% of items from beginning of array and try again
                var itemsToRemove = Math.ceil(storage.length * 0.25);
                storage.splice(0, itemsToRemove);
                
                try {
                    localStorage.setItem('logMessages', JSON.stringify(storage));
                } catch(e) {}
                
                // if storage still too big, recursively trim again
                var lsSize = JSON.stringify(localStorage).length / 1024;
                if (lsSize >= MAX_LOCAL_STORAGE_SIZE && storage.length > 0) {
                    trimLocalStorageSize();
                }
            }
            emit("trimmedLocalStorageSize", storage);
            return storage;
        }

        function registerLogger(logger) {
            // check if it contains the required functions
            assert(logger.getUid && logger.getCategory && 
                logger.getAndClearStatsInMemory, "Missing required Logger functions");

            registeredLoggers.push({
                logger: logger
            });

            logRegisteredStats(INTERVAL_WRITE_TO_DWH);
        }

        /***** Testing *****/

        // for testing purposes
        function setIntervalWriteToDWH(interval) {
            // restart timer
            logRegisteredStats(interval);
            currIntervalWriteToDWH = interval;
        }
        
        // for testing purposes
        function setMaxLocalStorageSize(size) {
            MAX_LOCAL_STORAGE_SIZE = size;
        }
        
        // for testing purposes
        function setSource(src) {
            source = src;
        }
        
        // for testing purposes
        function setMessageSendingWindowTime(t) {
            MESSAGE_SENDING_WINDOW_TIME = t;
        }

        // for testing purposes
        function setTestMode(mode) {
            testing = mode;
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
            loaded = false;
        });

        /***** Register and define API *****/

        /**
         * Logging plugin for Cloud9.
         *
         * Registers metrics such as events and duration.
         * Specialized metrics loggers, such as Duration, can register themselves
         * with the Log plugin to be written to our DWH
         * @singleton
         */
        plugin.freezePublicAPI({
            
            /**
             * Log a custom, self-defined metric to the Metric server.
             * @param {String}   type           The type of metric (e.g. 'event').
             * @param {String}   name           The name for the metric.
             * @param {Number}   uid            The Unique User ID.
             * @param {Array}    params         Any miscellaneous parameters.
             * @param {Function} callback       Called when the metric is logged.
             * @param {Error}    callback.err   The error information returned.
             */
            logMetric: logMetric,

            /**
             * Log an event to the Metric server.
             * @param {String}   name           The name for the event.
             * @param {Number}   [uid]          The Unique User ID.
             * @param {Array}    [params]       Any miscellaneous parameters.
             * @param {Function} [callback]     Called when the event is logged.
             * @param {Error}    callback.err   The error information returned.
             * @param {String}   callback.data  Optional status message.
             */
            logEvent: logEvent,

            /**
             * Log a message to the Metric server.
             * @param {String}   name           The name for the event.
             */
            logMessage: logMessage,

            /**
             * Register specific stats that need to be processed.
             *
             * This is required to do by plugins that want to log metrics
             * themselves, so the Logger plugin knows what to write to the DWH.
             * @param {Object} logger       The specialized Logger to registere
             */
            registerLogger: registerLogger,

            /**
             * Set the interval with which to send logs to the API server (thus to the DWH)
             * @param {Number} interval   The interval to set in milliseconds
             */
            setIntervalWriteToDWH: setIntervalWriteToDWH,
            
            /**
             * Set the maximum size the localStorage is allowed to be (for testing)
             * Don't set below 0.1, as localStorage size usually exceeds that with even minimal data
             * @param {Number} size   The maximum size in KB
             */
            setMaxLocalStorageSize: setMaxLocalStorageSize,
            
            /**
             * Set the source for metrics (for testing)
             * @param {String} src  The source for metrics, e.g. "desktop"
             */
            setSource: setSource,
            
            /**
             * Set the time for the window for sending messages
             * @param {Number} time   The time to set in milliseconds
             */
            setMessageSendingWindowTime: setMessageSendingWindowTime,
            
            /**
             * Set whether we're in test mode
             * @param {Boolean} testing   True means we're testing
             */
            setTestMode: setTestMode
        });

        register(null, { "log": plugin });
    }
});