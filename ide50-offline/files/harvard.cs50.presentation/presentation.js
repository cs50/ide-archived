define(function(require, exports, module) {
    main.consumes = [
        "fs.cache", "menus", "Plugin", "preferences", "settings", "tree", "ui"
    ];
    main.provides = ["c9.ide.cs50.presentation"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        var fsCache = imports["fs.cache"];
        var menus = imports.menus;
        var prefs = imports.preferences;
        var settings = imports.settings;
        var tree = imports.tree;
        var ui = imports.ui;
        
        var plugin = new Plugin("CS50", main.consumes);
        
        var presentationOn = false;
        var menuItem = null;
        
        var treeRowHeights = null;
        
        /**
         * swaps values of settings at path1 and path2. setting values are
         * assumed to be numeric.
         * 
         * @param {string} path1 path of first setting
         * @param {string} path2 path of second setting
         */
        function swapSettings(path1, path2) {
            var val = settings.getNumber(path2);
            settings.set(path2, settings.getNumber(path1));
            settings.set(path1, val);
        }
        
        /**
         * toggles presentation mode on or off.
         * 
         * @param {boolean} [override] ideally used when loading/unloading to
         * force toggle presentation mode on/off without saving settings.
         */ 
        function togglePresentationMode(override) {
            if (typeof override === "boolean") {
                // handle unloading when presentation is on
                if (!override && presentationOn) {
                    // toggle off presentation mode for ace and terminal
                    updateEditors();
                }
                if (override == presentationOn) {
                    return;
                }
                presentationOn = override;
                updateTree();
            }
            else {
                presentationOn = !presentationOn;
                settings.set("user/cs50/presentation/@on", presentationOn);
                updateEditors();
                updateTree();
            }
            
            // ensure menu item is in sync with the current mode
            menuItem.checked = presentationOn;
        }
        
        function updateEditors() {
            swapSettings(
                "user/cs50/presentation/@editorFontSize",
                "user/ace/@fontSize"
            );
            swapSettings(
                "user/cs50/presentation/@terminalFontSize",
                "user/terminal/@fontsize"
            );
        }
                
        function updateTree() {
            tree.off("draw", updateTree);
            if (!tree.container)
                return tree.on("draw", updateTree);
            if (presentationOn) {
                tree.container.classList.add("presentation-tree");
                fsCache.model.rowHeightInner = treeRowHeights.presentation;
                fsCache.model.rowHeight = treeRowHeights.presentation;
            }
            else {
                tree.container.classList.remove("presentation-tree");
                fsCache.model.rowHeightInner = treeRowHeights.default;
                fsCache.model.rowHeight = treeRowHeights.default;
            }
            tree.tree.renderer.updateFull();
        }
        
        plugin.on("load", function() {
            // add menu item to View menu
            menuItem = new ui.item({
                type: "check",
                caption: "Presentation Mode",
                onclick: togglePresentationMode
            });
            
            menus.addItemByPath(
                "View/PresentationDiv", new ui.divider(), 1, plugin
            );
            menus.addItemByPath("View/Presentation Mode", menuItem, 2, plugin);
            
            treeRowHeights = {
                default: parseInt(
                    ui.getStyleRule(".filetree .tree-row", "height"), 10
                ) 
                || 22,
                presentation: 40
            };
            
            // CSS for tree
            ui.insertCss(
                require('text!./style.css'), 
                options.staticPrefix, 
                plugin
            );
            
            // default settings
            settings.on("read", function() {
                settings.setDefaults("user/cs50/presentation", [
                    ["on", false],
                    ["editorFontSize", 20],
                    ["terminalFontSize", 20]
                ]);
            });
            
            settings.on("write", function() {
                if (settings.getBool("user/cs50/presentation/@on") !== presentationOn) {
                    menus.click("View/Presentation Mode");
                }
            });
            
            // add toggle button to preferences
            prefs.add({
               "CS50" : {
                    position: 25,
                    "Presentation Mode" : {
                        position: 10,
                        "Presentation Mode" : {
                            type: "checkbox",
                            setting: "user/cs50/presentation/@on",
                            position: 200
                        }
                    }
                }
            }, plugin);
            
            togglePresentationMode(
                settings.getBool("user/cs50/presentation/@on")
            );
        });
        
        plugin.on("unload", function() {
            togglePresentationMode(false);
            menuItem = null;
            treeRowHeights = null;
        });
    
        register(null, {
            "c9.ide.cs50.presentation": plugin
        });
    }
});