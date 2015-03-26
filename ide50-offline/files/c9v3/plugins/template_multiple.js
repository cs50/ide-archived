define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "util", "settings", "ui", "layout",
        "anims", "menus"
    ];
    main.provides = ["example"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var util = imports.util;
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        var anims = imports.anims;
        var menus = imports.menus;
        var layout = imports.layout;
        
        /***** Generic Load *****/
        
        // Set up the generic handle
        var handle = new Plugin("Ajax.org", main.consumes);
        var handleEmit = handle.getEmitter();
        
        handle.on("load", function(){
            var x = new Example();
        });
            
        /***** Initialization *****/
        
        function Example(editor) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            
            var loaded = false;
            function load(){
                if (loaded) return false;
                loaded = true;
            }
            
            function draw(){
                // Import Skin
                ui.insertSkin({
                    name: "c9statusbar",
                    data: require("text!./skin.xml"),
                    "media-path" : options.staticPrefix + "/images/",
                    "icon-path"  : options.staticPrefix + "/icons/"
                }, plugin);
                
                // Create UI elements
                ui.insertMarkup(layout.findParent(plugin), markup, plugin);
            
            }
            
            /***** Methods *****/
            
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
            
            /***** Register and define API *****/
            
            /**
             * Draws the file tree
             * @event afterfilesave Fires after a file is saved
             * @param {Object} e
             *     node     {XMLNode} description
             *     oldpath  {String} description
             **/
            plugin.freezePublicAPI({
                /**
                 * Launches the Save As window which allows the user to save the 
                 * currently active file under a new name an path
                 * @param {Tab} tab an alternative tab to save as
                 * @param {Function} callback called after the file is saved
                 */
                show: show
                
                
            });
            
            plugin.load(null, "example");
            
            return plugin;
        }
        
        register(null, {
            example: handle
        });
    }
});