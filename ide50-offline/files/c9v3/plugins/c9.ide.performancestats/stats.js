/* global testMemoryLimit, testFakeError */
define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "http", "api", "vfs", "auth", "vfs.ping", "ext",
        "c9", "proc", "vfs.endpoint", "ui", "layout", "commands",
        "notification.bubble", "login", "api", "info", "dialog.alert",
        "dialog.error", "dialog.question"
    ];
    main.provides = ["performancestats"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var vfs = imports.vfs;
        var api = imports.api;
        var ui = imports.ui;
        var c9 = imports.c9;
        var layout = imports.layout;
        var info = imports.info;
        var commands = imports.commands;
        var proc = imports.proc;
        var auth = imports.auth;
        var login = imports.login;
        var vfsPing = imports["vfs.ping"];
        var bubble = imports["notification.bubble"];
        var vfsEndPoint = imports["vfs.endpoint"];
        var alert = imports["dialog.alert"].show;
        var showError = imports["dialog.error"].show;
        var question = imports["dialog.question"].show;
        var ext = imports.ext;
        var async = require("async");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var handleEmit = plugin.getEmitter();
        
        var DEBUG = false;
        var ENABLED = true; // c9.location.indexOf("stats=1") > -1;
        var STATS_INTERVAL = options.interval;
        var STATS_INTERVAL_INITIAL = options.interval / 4;
        var STATS_BUTTON_INTERVAL = 5000;
        var SSH = options.ssh;
        var RESOURCE_LIMIT_WARNING_TIMEOUT = 1000 * 60;
        var SUBSCRIPTION_URL = options.accountUrl + "/billing/subscription";
        
        var STATE_CREATED = 1;
        var STATE_READY = 2;
        var STATE_STOPPING = 11;
        var STATE_STOPPED = 12;
        var STATE_STARTING = 14;
        var STATE_MARKED_FOR_ARCHIVE = 20;
        var STATE_ARCHIVING = 21;
        var STATE_ARCHIVED = 22;
        var STATE_MARKED_FOR_RESTORE = 23;
        var STATE_RESTORING = 24;
        var STATE_RESIZING = 31;
        var STATE_MARKED_FOR_DELETE = 98;
        var STATE_DELETING = 99;

        var containers = options.containers;
        var sessionStart = Date.now();
        var userQuota;
        var lastPing;
        var lastBenchmark;
        var lastCPULimit = false;
        var lastLoad15Min;
        var lastOnlineDisconnects = 0;
        var lastOfflineDisconnects = 0;
        var lastMemFailCount = 0;
        var history = [];
        var server, button, menu, currentPlan, ddResize, ddResizePop;
        var currentWorkspaceSize, btnResize, btnResizePop, btnRestart;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (!ENABLED) return; // TODO: if we always enable this, disable quota plugin for non-ssh workspaces!
            
            if (SSH) return; //Don't show stats / quota for SSH workspaces. 
            
            if (DEBUG && !c9.standalone) {
                vfs.once("connect", function() {
                    setTimeout(sendStats, 3000);
                });
            }
            
            draw();
            
            if (!c9.standalone) {
                setTimeout(function() {
                    sendStats(true);
                    
                    setInterval(function() {
                        sendStats();
                    }, STATS_INTERVAL);
                    
                }, STATS_INTERVAL_INITIAL);
            }

            updateButton();
            setInterval(function() {
                updateButton();
            }, STATS_BUTTON_INTERVAL);
            
            login.on("ready", function(){
                var menu = login.menu;
                
                ui.insertByIndex(menu, new ui.divider(), 20, plugin);
                
                currentPlan = new ui.bar({ class: "current-plan" });
                menu.insertBefore(currentPlan, menu.firstChild);
                plugin.addElement(currentPlan);
                
                menu.on("prop.visible", function(e){
                    if (!menu.inited) {
                        ui.insertMarkup(currentPlan, require("text!./plan.xml"), plugin);
                        plugin.getElement("upgrade").on("click", function(){
                            handleEmit("confirmAccountRedirect", {
                                source: "menu"
                            });
                            window.open(SUBSCRIPTION_URL);
                        });
                        menu.inited = true;
                    }
                    
                    if (e.value) updateUserMenu();
                })
            }, plugin);
            
            c9.on("disconnect", onDisconnect);
        }
        
        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;
            
            ui.insertCss(require("text!./stats.less"), plugin);
            
            menu = new ui.menu({
                htmlNode: document.body,
                width: 344,
                // height: 414,
                class: "stats-menu"
            });
            
            button = new ui.button({
                "skin"    : "c9-simple-btn",
                // "caption" : "Share",
                "class"   : "stats-btn",
                "submenu" : menu
            });
            
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), button, 870, plugin);
            
            button.$ext.innerHTML = '\
                <div class="item disk">Disk <span class="progress"></span></div>\
                <div class="item mem">Memory <span class="progress"></span></div>\
                <div class="item cpu">CPU <span class="progress"></span></div>';
            
            var inited;
            menu.once("prop.visible", function(){
                ui.insertMarkup(menu, require("text!./stats.xml"), plugin);
                
                ddResize = plugin.getElement("ddResize");
                btnResize = plugin.getElement("btnResize");
                btnRestart = plugin.getElement("restart");
                
                populateContainerSizes(ddResize, btnResize);
                updateCurrentWorkspaceSize(false, function(err, details) {
                    ddResize.select(details.size);
                });
                
                plugin.getElement("plist").on("click", function(){
                    handleEmit("processListShow", { source: "resourceInfo" });
                    commands.exec("showprocesslist");
                });
                btnRestart.on("click", function(){
                    handleEmit("restartStart", { source: "resourceInfo" });
                    restart(function(){
                        handleEmit("restartEnd", { source: "resourceInfo" });
                    });
                });
                btnResize.on("click", function(){
                    handleEmit("resizeStart", {
                        source: "resourceInfo",
                        machine: ddResize.selected.data
                    });
                    resize(ddResize.selected.data, btnResize, function(){
                        handleEmit("resizeEnd", { source: "resourceInfo" });
                    });
                });
                
                updateMenu();
                inited = true; // Needed because of bug with once removal
            });
            
            menu.on("prop.visible", function(e){
                if (inited && e.value)
                    updateMenu();
            });
        }
        
        /***** Methods *****/
        
        function resize(options, btn, callback){
            var ram = options.ram;
            var disk = options.disk;
            var cpu = options.cpu;
            
            if (!ram || !disk || !cpu)
                return callback(new Error("Invalid Arguments"));
            
            if (options.name == currentWorkspaceSize) {
                return alert("Workspace is already this size",
                    "Please select a different size",
                    "This workspace is already of size '" + options.name 
                        + "' and can therefore not be resized to this size. "
                        + "Please select another size and try again.");
            }
            
            document.body.classList.add("noInput");
            menu.setAttribute("class", "resizing stats-menu");
            btn.setCaption("Resizing...");
            btn.disable();
            
            function done(err){
                if (err) {
                    displayError(err);
                } else {
                    alert("Resize complete", "", "Workspace resize completed successfully");
                }
                document.body.classList.remove("noInput");
                menu.setAttribute("class", "stats-menu");
                btn.setCaption("Resize");
                btn.enable();
            }
            
            function displayError(err) {
                var quotaError = err.message.match(/Not enough ([a-z]+) quota available/);
                if (quotaError) {
                    return question("Not enough " + quotaError[1] + " quota",
                        "",
                        "Your account does not have enough " + quotaError[1] +
                        " quota available to resize this workspace. Would you like to upgrade?",
                        function() { // yes
                            handleEmit("confirmAccountRedirect", {
                                source: "confirmation"
                            });
                            window.open(SUBSCRIPTION_URL);
                        },
                        function() { /* no - do nothing */ }
                    );
                }
                
                var resizeError =  "Unfortunately your workspace failed to resize correctly. Please try again and if it continues to fail please contact support.";
                if (err.message.match(/file size exceeds/)) {
                    resizeError = "Unfortunately you cannot resize your workspace as you are using more disk space than the size you chose allows.";
                };
         
                alert("Error resizing workspace",
                    "Could not resize workspace",
                    resizeError
                );
            }
            
            
            api.project.post("resize", {
                body: {
                    ram: ram,
                    disk: disk,
                    cpu: cpu
                }
            }, function(err){
                if (err) {
                    done(err);
                    return callback(err);
                }
                
                pollResize(function(err, data, working){
                    if (err) return; // Wait
                    
                    // Process error states
                    if (data.state == STATE_READY && data.error) {
                        done(new Error(data.error));
                        return callback(err);
                    }
                    
                    if (!working) {
                        done();
                        updateCurrentWorkspaceSize(true);
                        callback();
                    }
                });
            });
        }
        
        function pollResize(callback){
            api.project.get("resize/status", function(err, data){
                var working = data.state == STATE_RESIZING;
                callback(err, data, working);
                
                if (err || working)
                    setTimeout(function(){
                        pollResize(callback);
                    }, 500);
            });
        }
        
        function restart(callback){
            document.body.classList.add("noInput");
            menu.setAttribute("class", "restarting stats-menu");
            btnRestart.disable();
            
            function done(){
                alert("Restart complete", "", "Workspace restart completed successfully");
                document.body.classList.remove("noInput");
                menu.setAttribute("class", "stats-menu");
                btnRestart.enable();
            }
            
            api.project.post("restart", {}, function(err){
                if (err) {
                    // Process error states
                    alert("Error restarting workspace",
                        "Could not restart workspace",
                        "An error occurred restarting this workspace: " 
                        + err.message);
                    
                    done();
                    return callback(err);
                }
                
                done();
                callback();
            });
        }
        
        function updateCurrentWorkspaceSize(update, callback){
            callback = callback || function(){};
            info.getWorkspace(function(err, project){
                if (err) {
                    console.error(err);
                    return;
                }
                
                var ram, cpu, disk;
                if (c9.standalone) {
                    ram = 1024;
                    cpu = 1;
                    disk = 5 * 1024;
                } else if (project.remote) {
                    ram = project.remote.metadata.container.ram;
                    cpu = project.remote.metadata.container.cpu;
                    disk = project.remote.metadata.container.disk;
                } else { // Default new workspace values
                    ram = 512;
                    cpu = 1;
                    disk = 1024;
                }
                
                
                if (!containers.some(function(data){
                    if (data.ram == ram && data.disk == disk && data.cpu == cpu) {
                        currentWorkspaceSize = data.name;
                        return true;
                    }
                })) {
                    currentWorkspaceSize = "Custom";
                }
                
                var title = menu.$ext.querySelector(".title span");
                title && (title.innerHTML = currentWorkspaceSize);
                
                var menuWorkspaceName = button.$ext.querySelector("#menu-workspace-name");
                menuWorkspaceName && (menuWorkspaceName.innerHTML = currentWorkspaceSize);
                
                var diskAvailable = menu.$ext.querySelector(".graph-label .disk-available");
                diskAvailable && (diskAvailable.innerHTML = disk);
                
                var memoryAvailable = menu.$ext.querySelector(".graph-label .mem-available");
                memoryAvailable && (memoryAvailable.innerHTML = ram);
                
                return callback(null, {size: currentWorkspaceSize, disk: disk, ram: ram})
                
            }, update);
        }
        
        function populateContainerSizes(dd, btn){
            containers.forEach(function(item){
                var caption = item.name.uCaseFirst() + ": " + formatGB(item.ram) 
                    + " Ram, " + formatGB(item.disk) + " Disk, " 
                    + item.cpu + " CPU";
                
                dd.appendChild(new ui.item({ value: item.name, caption: caption, data: item }));
            });
            
            // dd.on("afterchange", function(){
            //     btn.setAttribute("disabled", this.getValue() == currentWorkspaceSize);
            // });
        }
        
        function updateMenu(){
            drawGraph(document.querySelector(".graph.mem"), history, "mem");
            drawGraph(document.querySelector(".graph.disk"), history, "disk");
            drawGraph(document.querySelector(".graph.cpu"), history, "cpu");
            
            var lastHistory = history[history.length-1];
            if (lastHistory != null) {
                lastHistory = lastHistory[1];
                if (lastHistory['cpu_used'] != null) { document.querySelector(".graph-label .cpu-used").innerHTML = Math.round((lastHistory['cpu_used'] / lastHistory['cpu_limit']) * 100); }
                if (lastHistory['disk_used'] != null) { document.querySelector(".graph-label .disk-used").innerHTML = lastHistory['disk_used']; }
                if (lastHistory['mem_used'] != null) { document.querySelector(".graph-label .mem-used").innerHTML = lastHistory['mem_used']; }
            }
            vfsPing.ping(function(err, result) {
                if (err) return;
                document.querySelector(".ping-time").innerHTML = 
                    "UI+network Latency: " + result + "ms";
            });
        }
        
        function updateButton(){
            getContainerStats(function(err, stats){
                if (err) return;
                
                stats = stats.stats;
                history = [];
                for (var i = 0; i < stats.ts.length; i++) {
                    var stat = {};
                    for (var key in stats)
                        stat[key] = stats[key][i];
                        
                    history[i] = [stats.ts[i], stat];
                }
                
                while (history.length > 101) history.shift();
                stats = history[history.length-1][1];
                
                if (menu.visible)
                    updateMenu();
                
                button.$ext.querySelector(".disk .progress").style.width = 
                    Math.round(Math.max(1, Math.min(1, stats.disk_used / stats.disk_limit) * 50)) + "px";
                button.$ext.querySelector(".mem .progress").style.width = 
                    Math.round(Math.max(1, Math.min(1, stats.mem_used / stats.mem_limit) * 50)) + "px";
                button.$ext.querySelector(".cpu .progress").style.width = 
                    Math.round(Math.max(1, Math.min(1, stats.cpu_used / stats.cpu_limit) * 50)) + "px";
                    
                // Hit a limit
                if (stats.mem_failcount > lastMemFailCount) {
                    lastMemFailCount = stats.mem_failcount;
                    button.$ext.querySelector(".mem .progress").className = "progress limit";
                    warnMemoryLimit();
                }
                if (stats.disk_limit && stats.disk_used >= stats.disk_limit) {
                    button.$ext.querySelector(".disk .progress").className = "progress limit";
                    warnDiskLimit();
                }
            });
        }
        
        function normalize(data, field, i){
            return Math.round((data[i][field + "_used"] || 1) / (data[i][field + "_limit"] || 1) * 40);
        }
        
        function timeNormalize(input){
            var data = [];
            var last;
            for (var i = input.length - 1; i >= 0; i--){
                var item = input[i];
                
                if (last && last - item[0] > (STATS_BUTTON_INTERVAL * 1.5)) {
                    var diff = Math.floor((last - item[0]) / STATS_BUTTON_INTERVAL);
                    for (var j = 0; j < diff; j++) data.unshift({});
                }
                last = item[0];
                data.unshift(item[1]);
                
                if (data.length >= 101) break;
            }
            return data;
        }
        
        function drawGraph(div, input, field) {
            var data = timeNormalize(input);
            if (!data || !data.length) return;
            
            div.innerHTML = "<canvas width='300' height='40'></canvas>";
            var c = div.firstChild.getContext('2d');
            
            var height = 40; 
            var width = 303;
            var minLineHeight = 1;
            var maxDataPoints = 101;
            var pointWidth = width / maxDataPoints;
            var graphOffset = width - (data.length * pointWidth); //So that the graph starts from the right and moves to left as data accumulates. 
            var doneInitialMove = false;
            
            c.strokeStyle = '#f00';
            c.beginPath();
             
            var l = Math.min(maxDataPoints, data.length);
            for (var i = 1; i < l; i ++) {
                if (data[i][field + "_used"]) { //make sure this data point has data, otherwise we'll get an infinite line when we try and draw it. 
                    if (!doneInitialMove) { //Move to the side of the graph at the height of the first point, incase we have a few points with no data at the beginning. 
                        c.moveTo(graphOffset, Math.max(minLineHeight, height - normalize(data, field, i)));
                        doneInitialMove = true;
                    }
                    c.lineTo(i * pointWidth + graphOffset, Math.max(minLineHeight, height - normalize(data, field, i)));
                }
            }
            
            c.lineTo((i - 1) * pointWidth + graphOffset, height);
            c.lineTo(graphOffset, height);
            c.closePath();
            // c.lineWidth = 5;
            c.fillStyle = ui.getStyle(div, "color") || '#8ED6FF';
            c.fill();
            // c.stroke();
        }
        
        function formatGB(size){
            if (size < 1024)
                return size + "MB";
            else
                return Math.round(size/1024 * 100)/100 + "GB";
        }
        
        function updateUserMenu(){
            getQuota(function(err, data){
                if (!err) {
                    userQuota = data;
                    
                    currentPlan.$ext.querySelector(".plan").innerHTML = data.name;
                    
                    currentPlan.$ext.querySelector(".mem .used").innerHTML = formatGB(data.used.ram);
                    currentPlan.$ext.querySelector(".mem .total").innerHTML = formatGB(data.total.ram);
                    currentPlan.$ext.querySelector(".mem .progress").style.width = Math.round((data.used.ram / data.total.ram) * 82) + "px";
                    
                    currentPlan.$ext.querySelector(".disk .used").innerHTML = formatGB(data.used.disk);
                    currentPlan.$ext.querySelector(".disk .total").innerHTML = formatGB(data.total.disk);
                    currentPlan.$ext.querySelector(".disk .progress").style.width = Math.round((data.used.disk / data.total.disk) * 82) + "px";
                }
            });
        }
        
        function onDisconnect() {
            server = null;
            vfsEndPoint.isOnline(function(err, isOnline) {
                if (isOnline)
                    lastOnlineDisconnects++;
                else
                    lastOfflineDisconnects++;
            });
        }
        
        function sendStats(initialStats) {
            var onlineDisconnects;
            var offlineDisconnects;
            if (initialStats) {
                // It's not really fair to estimate the number of disconnects
                // in <10 minutes, so let's not include numbers for this interval
                onlineDisconnects = undefined;
                offlineDisconnects = undefined;
            }
            else {
                onlineDisconnects = lastOnlineDisconnects;
                offlineDisconnects = lastOfflineDisconnects;
                lastOnlineDisconnects = lastOfflineDisconnects = 0;
            }
            
            async.series([
                function ping(next) {
                    vfsPing.ping(function(err, result) {
                        if (err) console.error("Ping failed", err);
                        lastPing = result; // might be undefined on err
                        next();
                    });
                },
                installServer,
                function benchmark(next) {
                    server.benchmark(lastPing, function(err, result) {
                        if (err) console.error("Benchmark failed", err);
                        lastBenchmark = result;
                        next();
                    });
                },
                function getCPULimit(next) {
                    if (!c9.hosted || SSH)
                        return next();
                    
                    server.getCPULimit(function(err, result) {
                        lastCPULimit = !err && result;
                        next();
                    });
                },
                function getCPULoad(next) {
                    if (!c9.hosted)
                        return next();
                    
                    proc.execFile("uptime", function(err, stdout, stderr) {
                        if (err) {
                            console.warn("Could not get system load");
                            return next();
                        }
                        var match = stdout.match(/.*?([\d.]+)$/m);
                        lastLoad15Min = match && parseInt(match[1], 10) || undefined;
                        next();
                    });
                },
                function sendResults(next) {
                    auth.request(vfs.serviceUrl + "/stats", {
                        timeout: 5000,
                        body: {
                            ping: lastPing,
                            version: c9.version,
                            benchmark: lastBenchmark,
                            cpuLimit: lastCPULimit,
                            load15Min: lastLoad15Min,
                            onlineDisconnects: onlineDisconnects,
                            offlineDisconnects: offlineDisconnects,
                            duration: Date.now() - sessionStart,
                            ssh: SSH,
                        },
                        contentType: "application/json",
                        method: "POST"
                    }, function(err, data, res) {
                        if (err) return console.error("Failed to send performance stats", err);
                    });
                }
            ]);
        }
        
        function installServer(callback) {
            if (server)
                return callback();
            
            ext.loadRemotePlugin("stats_server", {
                code: require("text!./server/stats_server.js"),
                redefine: true
            }, function(err, remote) {
                if (err) return callback(err);
                
                server = remote;
                callback();
            });
        }
        
        function getContainerStats(callback) {
            if (c9.standalone) {
                if (typeof testFakeError !== "undefined") return callback(new Error());
                return callback(null, {
                    "ts": Date.now(),
                    "stats": {
                        "ts": [Date.now()],
                        "disk_used": [834],
                        "disk_limit": [1500],
                        "mem_used": [Math.round(Math.random() * 512)],
                        "mem_limit": [512],
                        "mem_failcount": [typeof testMemoryLimit !== "undefined" 
                            ? lastMemFailCount + 1 : lastMemFailCount],
                        "cpu_used": [Math.round(Math.random() * 70 * 0.89)],
                        "cpu_limit": [70]
                    }
                });
            }
            
            api.project.get("stats", {}, callback);
        }
        
        function getQuota(callback){
            if (c9.standalone) {
                return callback(null, {
                    total: {
                        ram: 6 * 1024,
                        disk: 60 * 1024,
                        ssh: 1
                    },
                    used: {
                        ram: 4 * 1024,
                        disk: 25 * 1024,
                        ssh: 0
                    }
                });
            }
            
            api.user.get("quota", function(err, data){
                if (err) console.error(err);
                callback(err, data);
            });
        }
        
        var showing, lastShown = 0;
        function warnLimitHit(type, title, message, callback){
            var canShow = (+new Date() - lastShown) > RESOURCE_LIMIT_WARNING_TIMEOUT;
            if (showing || !canShow) return;
            showing = true;
            lastShown = +new Date();
            
            handleEmit("resourceLimitHit", {
                type: type
            });
            
            
            var html = bubble.popup("<strong style='color:#f06767'>" + title + "</strong>" + message, true, callback);
            if (!html) return;
            
            html.style.width = "300px";
            html.style.left = (html.offsetLeft - 100) + "px";
            html.className += " stats-bubble";
            
            bubble.on("closed", function handler(e) {
                if (e.html == html) {
                    showing = false;
                    html.bar.destroy(true, true);
                    bubble.off("closed", handler);
                    callback();
                }
            });
            
            html.bar = new ui.bar({ htmlNode: html });
            ui.insertMarkup(html.bar, require("text!./resize.xml"), plugin);
            
            ddResizePop = plugin.getElement("ddResizePop");
            btnResizePop = plugin.getElement("btnResizePop");
            populateContainerSizes(ddResizePop, btnResizePop);
            updateCurrentWorkspaceSize(false, function (err, details) {
                ddResizePop.select(details.size);
            });
            
            btnResizePop.on("click", function(){
                handleEmit("resizeStart", {
                    source: "resourceLimit",
                    machine: ddResizePop.selected.data
                });
                
                resize(ddResizePop.selected.data, btnResizePop, function(){
                    html.hideWindow(null, true);
                    handleEmit("resizeEnd", { source: "resourceLimit" });
                });
            });
        }
        
        function warnMemoryLimit(){
            warnLimitHit(
                "memory",
                "Memory limit hit", 
                "A running program hit a memory limit and was killed. You might want to consider resizing the workspace to a larger size.",
                function(){
                    resetProgressBars();
                }
            );
        }
        function warnDiskLimit(){
            warnLimitHit(
                "disk",
                "Disk quota reached", 
                "Your disk is almost full. When your disk is full normal operation won't be possible anymore. You might want to consider resizing your workspace.",
                function(){
                    resetProgressBars();
                }
            );
        }
        function warnCPULimit(){
            warnLimitHit(
                "cpu",
                "You've hit CPU limits", 
                "A running program is consuming near the CPU limit that this workspace provides. You might want to consider resizing your workspace to a larger size.",
                function(){
                    resetProgressBars();
                }
            );
        }
        
        function resetProgressBars() {
            button.$ext.querySelector(".cpu .progress").className = "progress";
            button.$ext.querySelector(".disk .progress").className = "progress";
            button.$ext.querySelector(".mem .progress").className = "progress";
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * Retrieve docker container stats, like memory and disk space used.
             * 
             * @param {Function} callback
             */
            getContainerStats: getContainerStats
        });
        
        register(null, { 
            "performancestats" : plugin 
        });
    }
});