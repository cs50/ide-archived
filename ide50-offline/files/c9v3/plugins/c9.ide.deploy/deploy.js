define(function(require, exports, module) {
    main.consumes = [
        "Panel", "settings", "ui", "anims", "panels", "commands", "Menu",
        "MenuItem", "Divider"
    ];
    main.provides = ["deploy"];
    return main;

    /*
        - Add settings/read/write
        - MongoLab Cloud9/openme2
            { "clouds" : "AWS_us-east-1" , "ssoSalt" : "Rzqwi1dEgMfM3ZWE7ex8ojTghBebEXIU9xvQVMJSeO7G69wF9JCSDvRxylM2Jhn" , "name" : "Cloud9" , "productName" : "Cloud9" , "plans" : [ "sandbox"]}
            https: //objectlabs.jira.com/wiki/display/partners/MongoLab+Partner+Integration+API
        - Closing output window, will open wrong session name at reconnect
        - args: [ "detach-client", "-t", procName ] is wrong in run.js. it needs to close the client only
        - Cannot type in textboxes of second form
        - Rename dynamic needs to change
        - Error during creating should remove the item?
        - Errors should have popup balloon (use tooltip)
        - Run shouldn't have a much bigger viewport
        - Open output plugin, then open another. The first one will be reset.
    */

    function main(options, imports, register) {
        var Panel = imports.Panel;
        var settings = imports.settings;
        var ui = imports.ui;
        var anims = imports.anims;
        var panels = imports.panels;
        var commands = imports.commands;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        
        var markup = require("text!./deploy.xml");
        var css = require("text!./style.css");
        
        /***** Initialization *****/
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 600,
            caption: "Deploy",
            className: "deploy",
            elementName: "winDeploy",
            minWidth: 165,
            width: 200,
            where: options.where || "left"
        });
        var emit = plugin.getEmitter();
        
        var mnuDeploy = new Menu({}, plugin);
        var mnuPrefs = new Menu({}, plugin);
        
        var sections, plugins = {}, instances = [];
        var btnCreate, barForm, scroller, btnClose, btnPrefs;
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            // Register this panel on the left-side panels
            plugin.setCommand({
                name: "toggledeploy",
                hint: "show the deploy panel",
                // bindKey      : { mac: "Command-Shift-D", win: "Ctrl-Shift-D" }
            });
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            // Import Skin
            ui.insertSkin({
                name: "deploy",
                data: require("text!./skin.xml"),
                "media-path" : options.staticPrefix + "/images/",
                "icon-path"  : options.staticPrefix + "/images/"
            }, plugin);
            
            // Create UI elements
            ui.insertMarkup(opts.aml, markup, plugin);
            
            // Import CSS
            ui.insertCss(css, plugin);
        
            settings.on("read", function(){
                settings.setDefaults("user/deploy", [["log", "deploy"]]);
                
                sections = [
                    {caption: "Development"}, 
                    {caption: "Testing"}, 
                    {caption: "Staging"}, 
                    {caption: "Production"}
                ];
            }, plugin);
        
            // Create UI elements
            btnCreate = plugin.getElement("btnCreate");
            btnClose = plugin.getElement("btnClose");
            btnPrefs = plugin.getElement("btnPrefs");
            barForm = plugin.getElement("barForm");
            
            btnCreate.setAttribute("submenu", mnuDeploy.aml);
            btnPrefs.setAttribute("submenu", mnuPrefs.aml);
            btnClose.on("click", function(){ hideForm(); });
            
            var group = new ui.group({ value: "user/deploy/@log"});
            mnuPrefs.append(new MenuItem({
                caption: "Show Deploy Log When Deploying",
                type: "radio",
                group: group,
                value: "deploy",
                position: 100
            }));
            mnuPrefs.append(new MenuItem({
                caption: "Show Deploy Log During Deploy Error",
                type: "radio",
                group: group,
                value: "error",
                position: 200
            }));
            mnuPrefs.append(new MenuItem({
                caption: "Don't Show Deploy Log",
                type: "radio",
                group: group,
                value: "none",
                position: 300
            }));
            mnuPrefs.append(new Divider({ position: 400 }, plugin));
            
            var bar = plugin.getElement("winDeploy");
            scroller = bar.$ext.appendChild(document.createElement("div"));
            scroller.className = "scroller";
            sections.forEach(function(section, i) {
                var frame = ui.frame({ 
                    htmlNode: scroller,
                    buttons: "min",
                    activetitle: "min",
                    caption: section.caption,
                    childNodes: [
                        ui.label({
                            caption: "No Instances Yet",
                            margin: "10",
                            style: "color:#ccc"
                        })
                    ]
                });
                
                sections[section.caption.toLowerCase()] = frame;
            });
        }
        
        /***** Methods *****/
        
        function registerPlugin(plugin) {
            plugins[plugin.name] = plugin;
        }
        
        function unregisterPlugin(plugin) {
            delete plugins[plugin.name];
        }
        
        var lastMeta;
        function showForm(form, meta) {
            if (barForm.$int.firstChild)
                barForm.$int.removeChild(barForm.$int.firstChild);
            form.attachTo(barForm.$int, 
                barForm.firstChild && barForm.firstChild.$ext);
            
            lastMeta = meta;
            form.meta = meta;
            
            btnClose.show();
            btnCreate.hide();
            
            setTimeout(function(){
                var height = form.getRect().height + 26;
                anims.animateMultiple([
                    {
                        node: barForm,
                        height: (height) + "px",
                        duration: 0.15,
                        timingFunction: "cubic-bezier(.10, .10, .25, .90)"
                    },
                    {
                        node: scroller,
                        top: (height) + "px",
                        duration: 0.15,
                        timingFunction: "cubic-bezier(.10, .10, .25, .90)"
                    }
                ], function(){ });
            }, 30);
        }
        
        function hideForm(){
            if (lastMeta)
                emit("formHide", { meta : lastMeta });
            
            lastMeta = undefined;

            anims.animateMultiple([
                {
                    node: barForm,
                    height: "0px",
                    duration: 0.15,
                    timingFunction: "cubic-bezier(.10, .10, .25, .90)"
                },
                {
                    node: scroller,
                    top: "26px",
                    duration: 0.15,
                    timingFunction: "cubic-bezier(.10, .10, .25, .90)"
                }
            ], function(){
                btnClose.hide();
                btnCreate.show();
            });
        }
        
        function addInstance(instance, where, plugin) {
            instances.push(instance);
            
            plugin.addOther(function(){ instance.unload(); });
            instance.on("unload", function(){
                instances.splice(instances.indexOf(instance), 1);
            });

            var frame = sections[where] || sections.development;
            instance.attachTo(frame);
            
            return instance;
        }
        
        function moveInstance(instance, where) {
            var frame = sections[where] || sections.development;
            instance.attachTo(frame);
        }
        
        function getAll(type) {
            return instances.filter(function(instance) {
                return instance.type == type;
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
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
            mnuDeploy: mnuDeploy,
            mnuPrefs: mnuPrefs,
            
            /**
             * 
             */
            register: registerPlugin,
            
            /**
             * 
             */
            unregister: unregisterPlugin,
            
            /**
             * 
             */
            addInstance: addInstance,
            
            /**
             * 
             */
            moveInstance: moveInstance,
            
            /**
             * 
             */
            getAll: getAll,
            
            /**
             * 
             */
            showForm: showForm,
            
            /**
             * 
             */
            hideForm: hideForm
        });
        
        register(null, {
            deploy: plugin
        });
    }
});