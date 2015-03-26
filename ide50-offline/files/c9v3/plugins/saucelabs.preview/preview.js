/**
 * SauceLabs Preview for Cloud9
 */
define(function(require, exports, module) {
    main.consumes = [
        "Previewer", "preview", "tabManager", "http", "settings", "ui", 
        "Menu", "MenuItem", "Divider", "preview.saucelabs.connect",
        "preview.saucelabs.auth", "dialog.error", "dialog.login",
        "log", "c9.analytics", "api", "dialog.alert"
    ];
    main.provides = ["preview.saucelabs"];
    return main;

    function main(options, imports, register) {
        var Previewer = imports.Previewer;
        var preview = imports.preview;
        var tabs = imports.tabManager;
        var http = imports.http;
        var ui = imports.ui;
        var settings = imports.settings;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var alert = imports["dialog.alert"].show;
        var showError = imports["dialog.error"].show;
        var hideError = imports["dialog.error"].hide;
        var connect = imports["preview.saucelabs.connect"];
        var auth = imports["preview.saucelabs.auth"];
        var showLogin = imports["dialog.login"].show;
        var api = imports.api;
        var log = imports.log;
        var analytics = imports["c9.analytics"];
        
        /***** Initialization *****/
        
        var plugin = new Previewer("Sauce Labs, Inc.", main.consumes, {
            caption: "Desktop Browser (Sauce Labs)",
            index: 300,
            submenu: true
        });
        
        var BASEURL = auth.getServerURL();
        var PREVIEWER_ID = "preview.saucelabs";
        var DESKTOP_ORIGIN = "file://";
        var BASH = options.bashBin || "bash";
        var IS_DESKTOP = location.origin === DESKTOP_ORIGIN;
            
        var sauceMenu, mobileMenu, currentSession, selectedBrowser;
        var numRecentBrowsers = 4;
        var sessions = [];
        var drawn;
        
        var browserMap = {
            firefox: 'FF',
            android: 'Android',
            googlechrome: 'Chrome',
            iexplore: 'IE',
            ipad: 'iPad',
            iphone: 'iPhone',
            opera: 'Opera',
            safari: 'Safari',
            "Windows 2012"  : "Win8",
            "Windows 2008"  : "Win7",
            "Windows 2003"  : "XP",
            "Mac 10.6"      : "10.6",
            "Mac 10.8"      : "10.8",
            "Linux"         : "Linux"
        };
        var mobileMap = {
            android: true,
            ipad: true,
            iphone: true
        };
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            // Only load when preview is being shown,
            // or retry when menu is opened
            preview.on("draw", draw.bind(null, true));
            plugin.menu.on("show", draw);
            
            var mobileItem = new MenuItem({ 
                caption: "Mobile Browser (Sauce Labs)", 
                position: 301
            });
            mobileItem.submenu = mobileMenu = new Menu({}, plugin);
            preview.previewMenu.append(mobileItem);
            
            tabs.on("tabBeforeClose", function(e) {
                var tab = e.tab;
                if (tab.editorType != "preview")
                    return;
                
                var session = tab.document.getSession();
                if (session.previewer != plugin)
                    return;
                
                if (!session.stopped) {
                    session.stop();
                    setTimeout(function(){ tab.close(); }, 500);
                    return false;
                }
            }, plugin);
            
            function onMessage(e) {
                // Hack for Firefox & Chrome: compare origins to own host and !null
                if (e.origin !== BASEURL && e.origin !== "null" && e.origin !== "https://" + document.location.host)
                    return;
                
                var data;
                try {
                    data = JSON.parse(e.data);
                }
                catch (e) {
                    return; // ignore error: message likely sent by some other plugin
                }
                var session = sessions[data.c9Id];
                if (session)
                    session.handleMessage(data);
            }
            window.addEventListener("message", onMessage, false);
            plugin.addOther(function(){
                window.removeEventListener("message", onMessage, false)
            });
        }
        
        /***** Helpers *****/
        
        function iterateSorted(obj, cb) {
            var keys = [];
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    keys.push(key);
                }
            }
            keys.sort(function(a, b) {
                if (/^[0-9\.]+$/.test(a) && /^[0-9\.]+$/.test(b)) {
                    a = parseFloat(a);
                    b = parseFloat(b);
                } else {
                    a = a.toString().toLowerCase();
                    b = b.toString().toLowerCase();
                }
                
                if (a < b) {
                    return -1;
                } else if (a > b) {
                    return 1;
                }
                return 0;
            });
            for (var i = 0; i < keys.length; i++) {
                key = keys[i].toString();
                cb(key, obj[key]);
            }                
        }
    
        function parseBrowsers(json) {
            var browsers = {};
            
            /**
             * Structure is:
             *  Browser ->
             *          OS ->
             *              Version
             */
            json.forEach(function(item) {
                var longName = item.long_name;
                var osRef = item.os;
                var verRef = item.short_version.toString();
                var verName = verRef === "" ? "Latest": verRef;
                verRef = verRef === "" ? "*": verRef;

                // Use just `os` to show multiple OS versions
                var os = item.os_display;
                
                if (osRef == "Windows 2008")      os = "Windows 7";
                else if (osRef == "Windows 2003") os = "Windows XP";
                else if (osRef == "Windows 2012") os = "Windows 8";
                else if (osRef == "Mac 10.6")     os = "OSX 10.6";
                else if (osRef == "Mac 10.8")     os = "OSX 10.8";
                    
                if (typeof browsers[longName] === 'undefined') {
                    browsers[longName] = {
                        nameRef: item.name,
                        os: {}
                    };
                }
                if (typeof browsers[longName].os[os] === 'undefined') {
                    browsers[longName].os[os] = {
                        osRef: osRef,
                        ver: {}
                    };
                }
                if (typeof browsers[longName].os[os].ver[verName] === 'undefined') {
                    browsers[longName].os[os].ver[verName] = {
                        verRef: verRef
                    };
                }
            });
            
            return browsers;
        }
        
        function fatalError(err, session) {
            showError("Preview failed: " + (err.message || err));
            
            if (!session)
                session = currentSession;
                
            if (session && session.iframe) {
                session.stop();
                
                session.tab.classList.add("error");
                
                var html = require("text!./failed.html").replace("{{ERROR}}", "SauceLabs preview failed");
                session.iframe.src = "data:text/html," + encodePreviewHtml(html);
                // HACK: Chrome sometimes ignores the new page
                setTimeout(function() {
                    session.iframe.src = "data:text/html," + encodePreviewHtml(html);
                });
            }
        }
        
        function draw(hideErrors) {
            if (drawn)
                return;
            
            // Get all supported browsers
            http.request(BASEURL + "/rest/v1/info/scout", function(err, json) {
                if (err) return hideErrors || fatalError(err);
                if (drawn) return;
                
                var browsers = parseBrowsers(json);
                createMenus(browsers);
                drawn = true;
                
                // Load recent browsers from settings
                settings.on("read", function(){ 
                    if (!settings.getJson("user/saucelabs/preview")) {
                        // TODO: find a better way to get default versions of browsers
                        // we can't simply pass a string "latest", and picking the very
                        // latest from the list (e.g., Chrome 32) also can result in
                        // an error that it's not (yet) supported.
                        settings.setJson("user/saucelabs/preview", [
                            addBrowserToRecent(["googlechrome", "Windows 2012", "31"], true),
                            addBrowserToRecent(["iexplore", "Windows 2012", "10"], true),
                            addBrowserToRecent(["firefox", "Windows 2012", "26"], true),
                            addBrowserToRecent(["safari", "Mac 10.8", "6"], true),
                        ]);
                    }
                    
                    buildRecentBrowsers(); 
                }, plugin);
            });
        }
        
        /**
         * Go through all browsers and create submenus
         */
        function createMenus(browsers) {
            sauceMenu = plugin.menu;
            sauceMenu.append(new Divider({ position: 99 }, plugin));
            
            var position = 100;
            iterateSorted(browsers, function(browserName, browserObj) {
                var submenu = new Menu({}, plugin);
                var menu = mobileMap[browserObj.nameRef] ? mobileMenu : sauceMenu;
                menu.append(new MenuItem({
                    caption: browserName,
                    submenu: submenu,
                    position: position += 100
                }));

                // Get all the operating systems for this browser (e.g. Windows, Linux)
                var oses = browserObj.os;
                iterateSorted(oses, function(os, osObj) {
                    var subsubmenu;
                    if (menu === mobileMenu) {
                        subsubmenu = submenu;
                    }
                    else {
                        subsubmenu = new Menu({}, plugin);
                        submenu.append(new MenuItem({
                            caption: os,
                            submenu: subsubmenu
                        }));
                    }
                    
                    // Get all the OS versions
                    var versions = osObj.ver;
                    iterateSorted(versions, function(version, verObj) {
                        subsubmenu.append(new MenuItem({
                            caption: version,
                            onclick: function() {
                                var data = [browserObj.nameRef, 
                                    osObj.osRef, verObj.verRef];
                                previewCurrentFile(data);
                            }
                        }));
                    });
                });

            });
        }
        
        function buildRecentBrowsers() {
            if (!drawn)
                return;
            
            // Clear all current menu items;
            var items = sauceMenu.items;
            for (var i = items.length - 1; i >= 0; i--)
                if (items[i].position < 10) items[i].unload();
            
            // Create new menu items
            var position = 1;
            var recent = settings.getJson("user/saucelabs/preview");
            recent.forEach(function(browser, i) {
                sauceMenu.append(new MenuItem({
                    caption: browser.caption,
                    position: position++,
                    onclick: function() { previewCurrentFile(browser.value); }
                }));
            });
        }
        
        function addBrowserToRecent(browserData, admin) {
            var browserName = browserMap[browserData[0]];
            var platform = browserMap[browserData[1]];
            var version = browserData[2] == "*" ? "" : " " + browserData[2];
            var isMobile = mobileMap[browserData[0]];
            
            // Prepare info data
            var info = {
                value: browserData,
                caption: browserName + version 
                    + (platform && !isMobile ? " on " + platform : "")
            };
            
            var recent = settings.getJson("user/saucelabs/preview");
            
            if (admin || !recent || isMobile)
                return info;
            
            // Remove duplicate item if there
            for (var i = 0; i < recent.length; i++) {
                if (recent[i].caption == info.caption) {
                    recent.splice(i, 1);
                    break;
                }
            }
            
            // Add recent item to beginning of stack
            recent.unshift(info);
            
            // Remove an item that exceeds stack length
            if (recent.length > numRecentBrowsers)
                recent.pop();
            
            // Store settings
            settings.setJson("user/saucelabs/preview", recent);
            
            // Rebuild menu
            buildRecentBrowsers();
            
            return info;
        }
        
        function previewCurrentFile(browserData) {
            selectedBrowser = browserData;
            
            var editor = tabs.focussedTab.editor;
            editor.setPreviewer(PREVIEWER_ID);
            
            if (!currentSession) return;
            
            currentSession.changePreview(browserData, true);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("documentLoad", function(e) {
            var doc = e.doc;
            var session = doc.getSession();
            var tab = doc.tab;
            var editor = e.editor;
            var state = e.state || {};
            
            tab.on("beforeReparent", function(){
                var url = BASEURL + "/cloud9/resume/"
                    + session.taskId + "/" + session.id + session.authSuffix;
                if (session.iframe.src != url)
                    session.iframe.src = url;
            }, session);
            
            if (!editor.meta.$hasSauceButtons) {
                var locationBar = editor.getElement("locationbar");
                var btnStop = locationBar.appendChild(new ui.button({
                    id: "btnStop",
                    skin: "c9-toolbarbutton-glossy",
                    "class" : "close",
                    tooltip: "Stop",
                    width: "27",
                    onclick: function(){
                        currentSession && currentSession.stop();
                    }
                }));
                var lblTimeLeft = locationBar.appendChild(new ui.label({
                    id: "lblTimeLeft",
                    caption: "",
                    "class" : "preview-label"
                }));
                
                editor.addElement(btnStop, lblTimeLeft);
                editor.meta.$hasSauceButtons = true;
            }
            
            session.btnStop = editor.getElement("btnStop");
            session.lblTimeLeft = editor.getElement("lblTimeLeft");
            
            if (session.iframe) {
                session.editor = editor;
                editor.container.appendChild(session.iframe);
                
                if (!session.stopped)
                    session.showButtons();
                
                return;
            }
            
            if (!session.path)
                session.path = state.path;
            session.editor = editor;
            session.tab = tab;
            
            /**
             * browserData[0] = name
             * browserData[1] = OS
             * browserData[2] = browser version
             */
            session.changePreview = function(browserData, force) {
                if (!session.stopped && session.browser && session.browser.value == browserData)
                    return;
                
                if (IS_DESKTOP && !window.baseURI) {
                    // Server isn't ready yet, wait for it
                    return setTimeout(session.changePreview.bind(session, browserData, force), 1000);
                }
                
                // Track usage analytics: every session, incl browser/OS combo
                var isCloud9Account = auth.isCloud9Account();
                if (typeof isCloud9Account !== 'undefined') {
                    // this is a real preview, not just a reload of an open Sauce Labs preview
                    analytics.track("Sauce Labs Preview Opened", {
                        browserName: browserData[0],
                        os: browserData[1],
                        browserVersion: browserData[2],
                        isCloud9Account: isCloud9Account,
                        source: IS_DESKTOP ? "desktop" : "web"
                    });
                    log.logEvent("Sauce Labs preview opened");
                }
                
                if (!connect.isActive())
                    iframe.src = "data:text/html," + require("text!./loading.html").replace(/#/g, "%23");
                
                // Use Sauce Connect if needed
                connect.start(function(err) {
                    if (err) return fatalError(err, session);
                    
                    // Get Sauce Labs account details
                    auth.getAccount(function(err, account) {
                        if (err) return fatalError(err, session);
                        
                        // Make sure the credentials are valid
                        if (!account.apikey || !account.username)
                            return login();
                        
                        session.authSuffix = "?username=" + account.username
                            + "&access_key=" + account.apikey;
                        if (!force && session.taskId) {
                            iframe.src = BASEURL + "/cloud9/resume/"
                                + session.taskId + "/" + session.id + session.authSuffix;
                        }
                        else {
                            // Get cloud9 authentication token to allow access to host
                            api.preview.post("tokens", function(err, data) {
                                if (err) return fatalError(err, session);
                                
                                var origin = IS_DESKTOP
                                    ? window.baseURI.replace(/(.*\/\/[^/]*).*/, "$1")
                                    : location.origin;
                                var base = preview.previewUrl.charAt(0) == "/"
                                    ? origin + preview.previewUrl
                                    : preview.previewUrl;
                                
                                var path = session.path;
                                var npath = /^https?:/.test(path) ? path : base + path;
                                
                                if (!data.token) 
                                    showError("Could not get security token. Trying without.");
                                else {
                                    var parts = npath.split("#");
                                    npath = parts[0] 
                                        + (parts[0].indexOf("?") > -1 ? "&" : "?")
                                        + "__c9_preview_id__=" + data.token;
                                }
                                
                                var c9loc = encodeURIComponent(npath.replace(/\//g, "$2F"));
                                
                                iframe.src = BASEURL + "/cloud9/preview/"
                                    + browserData[0] + "/" + browserData[1].replace(/ /g, "%20") 
                                    + "/" + browserData[2] + "/" + c9loc + "/" + session.id
                                    + session.authSuffix;
                            });
                        }
                    });
                });
                    
                session.browser = addBrowserToRecent(browserData);
                session.editor.setButtonStyle(session.browser.caption, 
                    options.staticPrefix + "/images/saucelabs-icon.ico");
                session.stopped = false;
                // session.activate();
            };
            
            session.stop = function(){
                session.stopped = true;
                
                tab.classList.remove("error");
                tab.classList.remove("loading");
                
                if (session.hideButtons)
                    session.hideButtons();
                
                if (!session.taskId || !drawn)
                    return;
                
                var msg = JSON.stringify({stop: true});
                if (!iframe.src.match(/data:text/)) { // && iframe.contentWindow.c9
                    if (IS_DESKTOP)
                        iframe.contentWindow.c9.origins[0] = DESKTOP_ORIGIN;
                    iframe.contentWindow.postMessage(msg, BASEURL);
                }
                session.setTimeRemaining();
                
                // Note: we don't stop sauce connect; it takes too long to start
                // connect.stop();
                
                delete session.taskId;
            };
            
            //app.tabManager.focussedTab.document.getSession().handleMessage({timeLeft:true, hr:1, min:5, sec:30});
            session.handleMessage = function(data) {
                // TODO: handle errors
                // The job request is send
                if (data.taskId) {
                    session.taskId = data.taskId;
                }
                // The session has started
                else if (data.jobId) {
                    tab.classList.remove("error");
                    tab.classList.remove("loading");
                    session.showButtons();
                    session.setTimeRemaining();
                    session.jobId = data.jobId;
                }
                // Update of the amount of time that is left
                else if (data.timeLeft) {
                    if (session.stopped) return;
                    session.setTimeRemaining(data);
                }
                // The time remaining is 0
                else if (data.timeout) {
                    tab.classList.add("error");
                }
                // An error has occurred
                else if (data.error) {
                    tab.classList.add("error");
                    tab.classList.remove("loading");
                    if (data.message && data.message.match(/run out of minutes|purchase a subscription/)) {
                        notifyExpired(data.message.match(/purchase a subscription/));
                    }
                }
                else if (data.signup) {
                    signup();
                }
                else if (data.login) {
                    login();
                }
            };
            
            var iframe = document.createElement("iframe");
            
            // TODO: For security, this should be enabled, but atm we need it
            //       to receive events, at least for node-webkit up to 0.9.1
            //       (see https://github.com/rogerwang/node-webkit/issues/534)
            // iframe.setAttribute("nwfaketop", true);
            iframe.setAttribute("nwdisable", true);

            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = 0;
            iframe.style.backgroundColor = "rgba(255, 255, 255, 0.88)"; //rgb(42, 58, 53)"; //
            
            iframe.addEventListener("load", function(){
                // tab.classList.remove("loading");
            });
            iframe.addEventListener("error", function(){
                // tab.classList.remove("loading");
                tab.classList.add("error");
            });
            
            session.iframe = iframe;
            session.id = sessions.push(session) - 1;
            
            tab.classList.add("loading");
            
            session.showButtons = function(){
                session.btnStop.show();
                session.lblTimeLeft.show();
            }
            
            session.hideButtons = function(){
                session.btnStop.hide();
                session.lblTimeLeft.hide();
            }
            
            session.setTimeRemaining = function(time){
                session.lblTimeLeft.setAttribute("caption", !time ? "" : "Time Remaining: " 
                    + (time.hr ? time.hr + ":" : "")
                    + (time.min < 10 ? "0" : "") + time.min + ":"
                    + (time.sec < 10 ? "0" : "") + time.sec);
            }
            
            session.destroy = function(){
                session.btnStop.hide();
                session.lblTimeLeft.hide();
                delete session.editor;
                delete session.iframe;
                delete session.changePreview;
                delete session.stop;
                delete session.handleMessage;
                delete session.showButtons;
                delete session.hideButtons;
                delete session.setTimeRemaining;
                delete session.destroy;
            };
            
            session.changePreview(selectedBrowser);
            // preview.container.$int.appendChild(session.iframe);
            editor.container.appendChild(session.iframe);
        });
        plugin.on("documentUnload", function(e) {
            var doc = e.doc;
            var session = doc.getSession();
            var iframe = session.iframe;
            
            if (!e.toEditor || e.toEditor.type != "preview") {
                session.stop();
                
                // Don't remove iframe immediately because it won't be able to send the stop
                var pNode = iframe.parentNode;
                setTimeout(function(){
                    if (iframe.parentNode == pNode)
                        pNode.removeChild(iframe);
                }, 500);
                
                sessions.splice(sessions.indexOf(session), 1);
            }
            
            doc.tab.classList.remove("loading");
            
            if (currentSession == session)
                currentSession = null;
        });
        plugin.on("documentActivate", function onActivate(e) {
            if (!drawn)
                return setTimeout(onActivate.bind(null, e), 1000);
            var session = e.doc.getSession();
            var tab = e.doc.tab;
            if (session.previewer != plugin) return; // @todo is this still needed?
            
            session.iframe.style.display = "block";
            
            var path = session.path;
            var base = location.protocol + "//" + location.host + "/workspace";
            var url = /^https?:/.test(path) ? path : base + path;
            
            tab.title = "[P] " + session.path;
            tab.tooltip = "[P] " + session.path;
            
            session.editor.setLocation(url);
            session.editor.setButtonStyle(session.browser.caption, 
                options.staticPrefix + "/images/saucelabs-icon.ico");
            
            if (session.taskId)
                session.showButtons();
            else 
                session.hideButtons();
            
            session.editor.getElement("btnSettings").hide();
            
            currentSession = session;
        });
        plugin.on("documentDeactivate", function(e) {
            var session = e.doc.getSession();
            if (session.previewer != plugin) return; // @todo is this still needed?
    
            if (session.iframe)
                session.iframe.style.display = "none";
            
            currentSession.hideButtons();
            
            if (currentSession == session)
                currentSession = null;
        });
        plugin.on("navigate", function onNavigate(e) {
            if (plugin.activeSession.path == e.url)
                return;
            
            return showError("Navigation via location bar is turned off. "
                + "Interact with the browser directly to set the location.");
            
            // // Wait if we haven't drawn yet
            // if (!drawn)
            //     return setTimeout(onNavigate.bind(null, e), 1000);
                
            // var tab = plugin.activeDocument.tab;
            // var session = plugin.activeSession;
            
            // session.stop();
            // session.changePreview(session.browser.value, true);
            
            // tab.title = tab.tooltip = "[P] " + e.url;
            // session.editor.setLocation(e.url);
        });
        plugin.on("update", function(e) {
            // var iframe = plugin.activeSession.iframe;
            //@todo
        });
        plugin.on("reload", function(){
            var session = plugin.activeSession;
            session.stop();
            session.tab.classList.add("loading");
            session.changePreview(session.browser.value, true);
        });
        plugin.on("popout", function(){
            var session = currentSession;
            if (!session || session.stopped) return;
            
            var src = BASEURL + "/cloud9/resume/"
                + session.taskId + "/" + session.id + session.authSuffix;
            window.open(src);
        });
        plugin.on("setState", function(e) {
            if (e.state.previewer !== PREVIEWER_ID)
                return;
            var state = e.state;
            var session = e.doc.getSession();
            
            session.taskId = state.taskId;
            session.jobId = state.jobId;
            // session.tab = e.doc.tab;
            selectedBrowser = state.selectedBrowser;
        });
        
        plugin.on("getState", function(e) {
            var state = e.state;
            var session = e.doc.getSession();
            
            state.taskId = session.taskId;
            state.jobId = session.jobId;
            state.selectedBrowser = selectedBrowser;
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
            // drawn = false;
        });
        
        function notifyExpired(trial) {
            var reason;
            var why;
            if (trial) {
                why = "Trial ended";
                log.logEvent("Sauce Labs trial expired");
                
                // open a window using signup() instead
                reason = 'Your Sauce Labs trial ended!<br/> Please create an account at '
                + '<a href=\'javascript:parent.postMessage(JSON.stringify({signup:true, c9Id: ' 
                + currentSession.id + '}), "' + location.origin + '");\'>'
                + 'saucelabs.com</a>,<br/> and '
                + '<a href=\'javascript:parent.postMessage(JSON.stringify({login:true, c9Id: ' 
                + currentSession.id + '}), "' + location.origin + '")\'>'
                + 'login with your account</a>.';
            }
            else {
                why = "Out of minutes";
                log.logEvent("Sauce Labs out of minutes");
                reason = 'Sauce Labs Preview Failed<p>You appear to be out of minutes! Please visit '
                + '<a href="https:/saucelabs.com">saucelabs.com</a> and check your account page.';
            }
            // Analytics for expiration
            analytics.track("Sauce Labs trial expired", {
                reason: why,
                source: IS_DESKTOP ? "desktop" : "web"
            });
                
            var html = require("text!./failed.html").replace("{{ERROR}}", reason);
            currentSession.iframe.src = "data:text/html," + encodePreviewHtml(html);
        }
        
        function signup() {
            // Analytics for redirect to upgrade
            analytics.track("Open Sauce Labs signup", {
                source: IS_DESKTOP ? "desktop" : "web"
            });
            log.logEvent("Open Sauce Labs signup");
            if (IS_DESKTOP) {
                window.nativeRequire("nw.gui").Shell.openExternal("http://saucelabs.com/signup?ref=c9");
            }
            else {
                // open up a new window with the URL
                // This will result in a popup blocker on Firefox (not Chrome), so might want to improve that in the future
                var win = window.open("http://saucelabs.com/signup?ref=c9", "_blank");
                win.focus();
            }
        }
        
        function login(callback) {
            // Analytics for login
            analytics.track("Show Sauce Labs login", {
                source: IS_DESKTOP ? "desktop" : "web"
            });
            log.logEvent("Show Sauce Labs login popup");
            
            var lastError;
            showLogin(
                "SauceLabs Login",
                "Please sign in with your Sauce Labs account.",
                function(username, password, done) {
                    auth.login(username, password, function(err) {
                        if (err) {
                            lastError = showError(err);
                            done(false);
                            return;
                        }
                        
                        if (lastError)
                            hideError(lastError);
                        currentSession.changePreview(selectedBrowser);
                        
                        // Analytics for login
                        analytics.track("Sauce Labs account logged in", {
                            username: username,
                            source: IS_DESKTOP ? "desktop" : "web"
                        });

                        callback && callback();
                        done(true);
                    });
                },
                function() {
                    callback && callback("Aborted");
                }
            );
        }
        
        /**
         * Encodes the HTML for the preview iframe; necessary for Firefox at least
         * @param {String} html The HTML to encode
         * @return {String} The encoded HTML
         */
        function encodePreviewHtml(html) {
            return html.replace(/#/g, "%23");
        }
        
        plugin.freezePublicAPI({});
        
        register(null, {
            "preview.saucelabs": plugin
        });
    }
});