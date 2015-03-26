define(function(require, exports, module) {
    main.consumes = ["Plugin", "vfs"];
    main.provides = ["installer"];
    return main;

    function main(options, imports, register) {
        
        /***** Initialization *****/
        
        var plugin = new imports.Plugin("Ajax.org", main.consumes);
        
        var loaded = false;
        function load(){
            if (loaded) return;
            loaded = true;
            
            imports.vfs.on("install", function(e) {
                e.callback(true);
            });
        }
        
        /***** Methods *****/
        
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        
        plugin.on("unload", function(){
            
        });
        
        /***** Register and define API *****/
        
        /**
         * Installer for Cloud9
         **/
        plugin.freezePublicAPI({
            show: function(){ alert("installer mock show called"); }
        });
        
        register(null, {
            installer: plugin
        });
    }
});