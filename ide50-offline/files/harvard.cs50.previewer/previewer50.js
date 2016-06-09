define(function(require, exports, module) {
    main.consumes = [
        "Previewer", "commands", "tabManager", "settings", "preview", "tree",
        "preview.browser", "proc", "dialog.error", "cs50.info", "dialog.alert"
    ];
    main.provides = ["cs50.previewer"];
    
    return main;

    function main(options, imports, register) {
        var Previewer = imports.Previewer;
        var preview = imports.preview;
        var commands = imports.commands;
        var tabs = imports.tabManager;
        var settings = imports.settings;
        var browser = imports["preview.browser"];
        var tree = imports.tree;
        var proc = imports.proc;
        var error = imports["dialog.error"];
        var info50 = imports["cs50.info"];
        
        /***** Initialization *****/
        
        var plugin = new Previewer("CS50", main.consumes, {
            caption: "CS50 Previewer", 
            index: 1,
            selector: matcher
        });
        
        // last tab that had focus
        var lastTab = null;

        /***** Methods *****/
        
        /*
         * Matches the paths that are handled by cs50.previewer
         */
        function matcher(path) {
            return /(?:\.html|\.htm|\.xhtml|\.php)$|^https?\:\/\//.test(path);
        }
        
        /*
         * Saves the previous tab
         */
        function saveLastTab(e) {
            lastTab = e.tab;
        }
        
        /*
         * Parses the options after a beforeOpen event
         */
        function parseOptions(e) {
            if (e.options.editorType == "preview" && matcher(e.options.name)) {
                tabs.focusTab(lastTab);
                return false;
            }
        }
        
        /*
         * Runs apache50 in the selected location, and opens a new tab
         */ 
        function startPreviewer() {
            // check if can preview
            if (!info50.canPreview) {
                error.show("This IDE is running on a domain that does not match this client's domain. " + 
                    "Please, try to Preview your files in a different client.");
                return;
            }

            var newTab = window.open('', '_blank');
            newTab.document.write('<h1>Starting apache50...</h1>' + 
                '<p>Please wait! The page will reload automatically.</p>');
            
            // parse selection path
            var selection = tree.selectedNode;
            var baseURL = '//' + info50.host;
            var file = "";
            
            // guarantees slash at the end of url
            if (baseURL.substr(-1) != "/") 
                baseURL += '/';
            
            // if selection is a file, save it in the file variable
            // the selection should be the enclosing folder
            if (selection && !selection.isFolder) {
                file = selection.label;
                selection = selection.parent;
            }
            
            // add workspace path
            var selectionPath = "/home/ubuntu/workspace" + selection.path;
            
            // run apache50 status
            proc.execFile("apache50", {
                args: ["start", selectionPath]
            }, function(err, stdout, stderr) {
                if (err) {
                    if (err.code == "EDISCONNECT") {
                        return;
                    }
                    else if (err.code == "ENOENT") {
                        error.show("Apache50 error. Consider running update50!");
                    }
                    else if (err.code == 2) {
                        newTab.location.href = baseURL + file;
                    }
                    else {
                        error.show("Something went wrong!");
                    }
                    
                    return;
                }

                newTab.location.href = baseURL + file;
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            // guarantees that the default previewer is raw
            settings.set("user/preview/@default", "preview.raw");
            
            // unregisters the preview.browser in order to give priority to CS50
            preview.unregister(preview.findPreviewer("", "preview.browser"));
            
            // remove preview.browser from options in menu
            preview.previewMenu.items[4].disabled = true;
            
            // register our plugin with matcher
            preview.register(plugin, matcher);
            
            // adds event handler to avoid switching tabs while using the previewer
            tabs.on("blur", saveLastTab);
            tabs.on("beforeOpen", parseOptions);
            
            // add cs50runApache command
            commands.addCommand({
                name: "cs50preview",
                hint: "CS50 Open Link in New Tab",
                group: "General",
                exec: startPreviewer
            }, plugin);
        });
        
        plugin.on("sessionStart", function(e) {
            // preferably the tab would not open, but this is not possible
            // with the current API
            e.session.tab.close();
            
            // simply run apache50 command
            commands.exec("cs50preview");
        });
        
        plugin.on("unload", function(){
            // unload lastTab
            lastTab = null;
            
            // unregister cs50.previewer
            preview.unregister(preview.findPreviewer("", "cs50.previewer"));
            
            // register preview.browser back again
            preview.register(browser, function(path) {
                return /(?:\.html|\.htm|\.xhtml)$|^https?\:\/\//.test(path);
            });
            
            // make browser options in preview available
            preview.previewMenu.items[4].disabled = false;
            
            // remove events for tabs
            tabs.off("blur", saveLastTab);
            tabs.off("beforeOpen", parseOptions);
        });
        
        /***** Register and define API *****/
        
        /**
         * Previewer for UTF-8 content.
         **/
        plugin.freezePublicAPI({
        });
        
        register(null, {
            "cs50.previewer": plugin
        });
    }
});
