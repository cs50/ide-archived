/**
 * This plugin shows quota warnings.
 *
 * @class Quota
 * @extends Plugin
 * @singleton
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "dialog.error", "proc"
    ];
    main.provides = ["quota"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var proc = imports.proc;
        var showError = imports["dialog.error"].show;
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            setTimeout(function() {
                proc.execFile(
                    "df",
                    { args: [options.workspaceDir] },
                    function(err, stdout, stderr) {
                        if (err) return console.error(err);
                        
                        if (/(99|100)%/.test(stdout))
                            showError("Your workspace is running out of quota. Please make some free space.", -1);
                    }
                );
            }, 45000);
        }
        
        plugin.on("load", function(){
            load();
        });
        
        register(null, { "quota" : plugin });
    }
});