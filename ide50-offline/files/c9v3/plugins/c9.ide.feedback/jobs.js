define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "c9", "settings", "dialog.notification"
    ];
    main.provides = ["jobs"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var settings = imports.settings;
        var c9 = imports.c9;
        var notify = imports["dialog.notification"].show;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var MONTH = 1000 * 60 * 60 * 24 * 30;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            var next = settings.getNumber("user/jobs/@next");
            if (!next) {
                next = parseInt(Date.now() + (Math.random() * MONTH), 10);
                settings.set("user/jobs/@load", next);
            }
            if (next == -1 || next > Date.now()) 
                return;
                
            c9.once("ready", function(){
                show();
            });
        }
        
        /***** Methods *****/
        
        /**
         * Show the Jobs bar with a nice animation
         */
        function show(){
            notify("<div class='jobs'>We're hiring engineers to help build the "
                + "future of development. Want to join our team in Amsterdam? "
                + "<a href='https://c9.io/site/jobs' target='_blank'>Click here"
                + "</a> for more information.</div>", true);
            
            // Insert CSS
            ui.insertCss(require("text!./jobs.css"), plugin);
            
            settings.set("user/jobs/@load", -1);
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
         * This plugin displays a Job announcement on top of the IDE
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            show: show
        });
        
        register(null, {
            jobs: plugin
        });
    }
});