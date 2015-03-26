/**
 * Test Panel for the Cloud9
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "util", "settings", "ui", "layout", "anims", //"tabManager", 
        "fs", "panels" //, "save"
    ];
    main.provides = ["test"];
    return main;
    
    /*
        - Ability (button + menu) to add a service:
            - Saucelabs
            - Jenkins
            - NodeUnit
            - JUnit
            - Wercker
            - CircleCI
            - TravisCI
        - A service is a frame, with title (icon?) that implements the UI for a test service
            - Generally this UI will consist of a tree and a toolbar with buttons
            - Lets walk through some of the use cases:
                - Saucelabs plugin:
                    - Offer ability to configure where the selenium tests are (perhaps configure the way to run them)
                    - Detect running them through the proxy or via the test panel
                    - When a test is run, contact the saucelabs api to:
                        - get status of the test
                        - get a movie to show in realtime what is happening (optional)
                    - use the proxy data to show deeper detail on what is going on
                    - show a movie after the test is executed (optional)
                - NodeUnit plugin:
                    - Offer ability to configure where the tests are (or how to add them automatically)
                    - When a test is run parse output and display status updates in grid
                    - Optionally allow for the output to be displayed in an output window
                - Jenkins / Wercker / CircleCI / TravisCI
                    - Would it be possible to configure this service here?
                    - Detect jobs initiated by this user (via git push, or otherwise)
                    - Display those jobs in the grid and allow to expand the datagrid to see detailed status
                    - Optionally allow for the output to be displayed in an output window
                    - Get notifications when a build failed (notification center?)
                        - With immediate actionability
                    - Allow ability to add other jobs (via job browser)
        FUTURE
            - Using the workflow panel, configure tests to run after a git push and on a copy of the workspace (instant CI)
                - Integrate with github to show job status
            - Extend by allowing to deploy after a successful push to a certain branch
            - Add deploy via NIX / Chef / Puppet / (S)FTP / SCP (auto-detect based on repo)
            - Offer GIT repos to easily offer these workflows without depending on another service
                - Easily viewable / manageable via git panel (view branches, browse commits, see history per file, issue PR, view PRs)
                - Only for teams?
            - Create dashboard widgets to easily get an overview over the builds, failed master commits, etc
            - Get notifications of failed tests (configurable) in the notification center
            - Get notifications of pushes by others to this repo in the notification center
            - Make available via CLI
                - Run Deploys
                - CRUD Deploys
                - Run Tests
                - CRUD Workflow
                - Tail Notifications
    */

    function main(options, imports, register) {
        var c9 = imports.c9;
        var util = imports.util;
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        var anims = imports.anims;
        var tabs = imports.tabManager;
        var save = imports.save;
        var panels = imports.panels;
        var layout = imports.layout;
        var fs = imports.fs;
        
        var markup = require("text!./test.xml");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            // Register this panel on the left-side panels
            panels.register({
                index: 200,
                caption: "Test",
                command: "toggletest",
                hint: "show the test panel",
                // bindKey      : { mac: "Command-Shift-D", win: "Ctrl-Shift-D" },
                className: "test",
                panel: plugin,
                elementName: "winTest",
                minWidth: 165,
                width: 200,
                draw: draw,
                where: "right"
            });
    
            settings.on("read", function(e) {
                settings.setDefaults("user/test", [
                    ["autorun", "none"],
                    ["type", "all"],
                    ["showlibraries", "true"],
                    ["autoexpand", "true"]
                ]);
            }, plugin);
        }
        
        var drawn = false;
        function draw(){
            if (drawn) return;
            drawn = true;
            
            // Create UI elements
            ui.insertMarkup(layout.findParent(plugin), markup, plugin);
            
            emit("draw");
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
            drawn = false;
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
        
        register(null, {
            test: plugin
        });
    }
});