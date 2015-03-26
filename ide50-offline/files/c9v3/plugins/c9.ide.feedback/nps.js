define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "log", "anims", "c9", "api", "info", 
        "dialog.alert", "dialog.notification"
    ];
    main.provides = ["nps"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var api = imports.api;
        var info = imports.info;
        var log = imports.log;
        var c9 = imports.c9;
        var alert = imports["dialog.alert"].show;
        var notify = imports["dialog.notification"].show;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var standalone = options.standalone;
        var container, user, _hide;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (standalone)
                return;
            
            user = info.getUser();
            api.user.get("nps_info", function(err, info) {
                if (err) return;
                
                var signedUpOn = info.createdAt;
                var npsLastShown = info.npsLastShown;
                // Show if user:
                // - has been active for more than half a day
                // - didn't see the NPS question for more than 30 days
                var signedupSince = Date.now() - signedUpOn;
                var hourTime = 60 * 60 * 1000;
                if (signedupSince > (4 * hourTime) &&
                    npsLastShown < (Date.now() - (30 * 24 * hourTime))) {
                    var npsTimeOut = 3000;
                    // Postpone extra 5 minutes if user is long active but did 
                    // not see NPS yet, e.g. seeing v3 for the first time
                    if (npsLastShown === 0) {
                        npsTimeOut = 5 * 60 * 1000;
                    }
                    c9.once("ready", function(){
                        setTimeout(function(){
                            show();
                        }, npsTimeOut);
                    });
                }
            });
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            _hide = notify("<div id='nps' class='nps'></div>");
            container = document.querySelector("#nps");
            
            // Insert CSS
            ui.insertCss(require("text!./nps.css"), plugin);
            
            var closing = [];
            var options = [0,1,2,3,4,5,6,7,8,9,10].map(function(nr) {
                closing.push("</span>");
                return "<span class='choice' id='" + nr + "' "
                    + " title='Click to submit'>"
                    + "<span class='nr' title='Click to submit'>" + nr + "</span>";
            }).join("");
            
            container.innerHTML = 
                "<label>How likely are you to recommend Cloud9 to friends and colleagues?</label>"
                + "<div class='options'>"
                + options + closing.join("")
                + "</div>"
                + "<div class='close'><img src='" + c9.staticUrl 
                + "/plugins/c9.ide.feedback/images/close.png' alt='Close' /></div>";
                
            container.addEventListener("click", function(e) {
                var node = e.target;
                if (node.parentNode.className == "choice")
                    node = node.parentNode;
                if (node.parentNode.className == "close")
                    node = node.parentNode;
                
                if (node.className == "choice") {
                    submitNps(node.id);
                }
                if (node.className == "close") {
                    hide();
                }
            });

            emit("draw");
        }
        
        /***** Methods *****/

        /**
         * Submit NPS score to the DWH
         * @param {Number} score The score for the NPS survey
         */
        function submitNps(score) {
            // submit NPS results to DWH
            log.logEvent('nps', user.id, {
                    score: score,
                }, function(err, result) { 
                if (err)
                    return alert("Sorry, please try again", "An error occurred", String(err));

                // Show confirmation for a few seconds, then hide the bar
                container.innerHTML = "<div class='nps confirmation'>"
                    + "Thanks for your vote!</div>";
                setTimeout(function(){
                    hide();
                }, 2000);
            });
        }
        
        /**
         * Show the NPS bar with a nice animation
         */
        function show(){
            draw();
        }
        
        /**
         * Hide the NPS bar with a nice animation and write to db when it was
         * last shown
         */
        function hide(){
            _hide();
            
            // Write to user db when NPS was last shown
            api.user.post("nps_last_shown", {}, function(err) {
                if (err)
                    return alert("Sorry, please try again", "An error occurred", err.message || String(err));
            });
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
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * This plugin displays a Net Promotor Score (NPS) bar on top of the IDE
         * to ask users if they would recommend Cloud9 to friends & colleagues
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            show: show,
            
            /**
             * 
             */
            hide: hide
        });
        
        register(null, {
            nps: plugin
        });
    }
});