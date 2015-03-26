define(function(require, exports, module) {
    main.consumes = [
        "settings", "Form", "DeployTarget", "libgae", "dialog.confirm",
        "deployinstance", "deploy", "dashboard", "proc", "tabManager",
        "Menu", "MenuItem", "Divider", "dialog.alert"
    ];
    main.provides = ["gae"];
    return main;

    function main(options, imports, register) {
        var Form = imports.Form;
        var DeployTarget = imports.DeployTarget;
        var dashboard = imports.dashboard;
        var settings = imports.settings;
        var alert = imports["dialog.alert"].show;
        var confirm = imports["dialog.confirm"].show;
        var Instance = imports.deployinstance;
        var deploy = imports.deploy;
        var proc = imports.proc;
        var tabs = imports.tabManager;
        var lib = imports.libgae;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        
        /***** Initialization *****/
        
        var plugin = new DeployTarget({
            icon: options.staticPrefix + "/gae-icon.png",
            caption: "Google App Engine",
            position: 100,
            type: "gae",
            appmenu: true,
            api: lib,
            singular: "app",
            plural: "apps"
        }, "Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var mnuSettings, authform, form, gaeDashboard;

        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            dashboard.registerProvider({
                name: "Google App Engine",
                logo: "plugins/c9.ide.dashboard/images/gae.png"
            });
            dashboard.register("gae_queries", "Google App Engine", "GAE Database Queries", 
                { type: "urlview", title: "GAE Database Queries", urlview: { value : "/static/charts/examples/line-basic/index.htm" } })
            dashboard.register("gae_connections", "Google App Engine", "GAE Connections",
                { type: "urlview", title: "GAE Connections", urlview: { value : "/static/charts/examples/line-basic/index.htm" } })
            
            gaeDashboard = dashboard.create({
                name: "gaedashboard",
                caption: "Google App Engine Dashboard",
                className: "gaedb",
                configurable: true,
                heading: {
                    dark: true,
                    height: 55,
                    logo: options.staticPrefix + "/gae-logo.png",
                    className: "gaenav",
                    backgroundColor: "rgb(35, 83, 8)"
                },
                widgets: { type: "hsplit", nodes: [
                    { id: "gae_queries" },
                    { id: "gae_connections", width: "50%"}
                ]}
            });
            
            settings.on("read", function(){
                // var instance = GAEInstance({ meta: { name: "rubendaniels" } });
                // deploy.addInstance(instance, "development", plugin);
                // plugin.update(instance, {}, function(){});
            }, plugin);
        }
        
        /***** Methods *****/
        
        function download(instance) {
            instance.state = "downloading";
            
            var name = instance.meta.name;
            lib.download({ name: name }, function done(err) {
                if (err) {
                    if (err.code == 100) {
                        lib.addkeys({}, function(err, success) {
                            if (success) done();
                            else {
                                alert(
                                    "Error Downloading " + name,
                                    "Invalid Keys while Downloading " + name,
                                    "Please make sure you have valid keys set "
                                    + "up and try again.\nGot the error: " + err
                                );
                                instance.state = instance.IDLE;
                            }
                        })
                    }
                    
                    alert(
                        "Error Downloading " + name,
                        "Unexpected error while downloading " + name,
                        "Got the error: " + err
                    );
                }
                else {
                    alert(
                        "successfully downloaded " + name,
                        "successfully downloaded " + name,
                        "You can find your download in the folder: " + name
                    );
                }
                
                instance.state = instance.IDLE;
            });
        }
        
        var fork = plugin.wrap("fork", function(instance, callback) {
            instance.state = "forking";
            
            var name = instance.meta.name;
            lib.fork({ app: name }, function(err, data) {
                if (err)
                    return callback(err);
                
                var forked = new GAEInstance({ meta: data });
                deploy.addInstance(forked, instance.where || "development", plugin);
                plugin.update(forked, {}, function(){});
                
                instance.state = instance.IDLE;
                callback(null, forked);
            });
        });
        
        var caption = {
            creating: "Creating Google App Engine App...",
            error: "Error",
            idle: "Ready.",
            deploying: "Deploying...",
            auth: "Authentication is Required",
            working: "Processing...",
            deleting: "Deleting...",
            forking: "Forking...",
            downloading: "Downloading..."
        }
        function render(htmlNode, instance) {
            var meta = instance.meta;

            htmlNode.innerHTML = ""
                + (instance.state == instance.AUTH
                    ? "<span class='state auth'>" + caption[instance.state] + "</span>"
                    : "<span class='state'>" + caption[instance.state] + "</span>")
                + "<span class='title' title='" + (meta.name || "") + "'>" 
                    + (meta.name 
                        ? "App: " + meta.name
                        : (instance.state == "auth" 
                            ? "No Title Yet" 
                            : "Requesting Title...")) + "</span>"
                + "<span class='last-deploy'>" + (meta.lastDeploy
                    ? "Deployed at " + new Date(meta.lastDeploy).toLocaleString()
                    : "Not Deployed Yet") + "</span>"
                // + (meta.stack
                //     ? "<a class='stack'>(" + meta.stack + " Stack)</a>"
                //     : "")
                + (meta.url
                    ? "<a class='url' target='_blank' href='" + meta.url + "'>" 
                        + meta.url 
                        + "</a>"
                    : "");
                // + (meta.git
                //     ? "<a class='git'>" + meta.git + "</a>"
                //     : "");
            
            htmlNode.querySelector(".title").onclick = function(){
                openDashboard(instance);
            }
            
            if (instance.state == instance.AUTH)
                htmlNode.firstChild.onclick = function(){ 
                    plugin.auth(instance);
                };
        }

        function destroyInteractive(instance, callback) {
            confirm(
                "Delete " + instance.meta.name + "?", 
                "Are you sure you want to delete " + instance.meta.name + "?", 
                "This will delete " + instance.meta.name 
                    + ", including all add-ons. This cannot be undone!", 
                function(){
                    plugin.destroy(instance, callback);
                }, function(){
                    callback(null, false);
                });
        }
        
        function openDashboard(instance) {
            var name = instance.meta.name;
            
            tabs.open({
                name: name + "_gaedashboard", // Forcing only a single tab per id
                editorType: "gaedashboard",
                active: true,
                document: {
                    title: name + " - Google App Engine Dashboard",
                    tooltip: name + " - Google App Engine Dashboard",
                    gaedashboard: {
                        app: name,
                        type: "gae",
                        output: {
                            id: "gae_" + name + "-log",
                            run: {
                                runner: { cmd: ["gae", "logs", "-t", "-a", name] },
                                options: {}
                            }
                        }
                    }
                }
            },function(){});
        }

        function createAuthForm(){
            authform = new Form({
                edge: "3 3 8 3",
                rowheight: 35,
                colwidth: 70,
                className: "deploy-form",
                style: "padding:10px;background-color:rgb(35, 83, 8);",
                form: [
                    {
                        type: "image",
                        src: options.staticPrefix + "/gae-logo.png",
                        width: 183,
                        height: 32
                    },
                    {
                        name: "loginfail",
                        type: "label",
                        caption: "Could not login. Please try again.",
                        style: "color:rgb(255, 143, 0);margin-left:5px;"
                    },
                    {
                        type: "submit",
                        caption: "Login to Google",
                        "default" : true,
                        margin: "10 20 5 20",
                        onclick: function(){
                            if (authform.validate())
                                plugin.login(null, authform.toJson(), function(){});
                        }
                    }
                ]
            });
            return authform;
        }
        
        function createForm(){
            // Application Create Form
            form = new Form({
                edge: "3",
                rowheight: 30,
                colwidth: 70,
                className: "deploy-form",
                style: "padding:10px;background-color:rgb(35, 83, 8);",
                form: [
                    {
                        type: "image",
                        src: options.staticPrefix + "/gae-logo.png",
                        width: 183,
                        height: 32
                    },
                    {
                        title: "Name",
                        name: "name",
                        type: "textbox",
                        height: "27",
                        edge: "3 3 8 3",
                        rowheight: 35
                    },
                    {
                        title: "Region",
                        name: "region",
                        type: "dropdown",
                        items: [
                            { value: "us", caption: "United States" },
                            { value: "eu", caption: "Europe" }
                        ],
                        defaultValue: "us"
                    },
                    // {
                    //     title  : "Stack",
                    //     name   : "stack",
                    //     type   : "dropdown",
                    //     items  : [
                    //         // @todo fetch these items on draw from the gae api
                    //         { value: "cedar",            caption: "Cedar" },
                    //         { value: "bamboo-ree-1.8.7", caption: "Bamboo-ree-1.8.7" },
                    //         { value: "bamboo-mri-1.9.2", caption: "Bamboo-mri-1.9.2" }
                    //     ],
                    //     defaultValue : "cedar"
                    // },
                    {
                        type: "submit",
                        caption: "Create",
                        "default" : true,
                        submenu: plugin.createMenu,
                        margin: "10 20 5 20"
                    },
                ]
            });
            return form;
        }

        function GAEInstance(options) {
            options.menu = plugin.settingsMenu;
            options.type = "gae";

            var instance = new Instance(options);
            instance.on("render", function(e) { 
                render(e.htmlNode, e.instance);
                return false; //@todo remove this
            });
            instance.on("rename", function(e) { 
                plugin.rename(e.instance, e, function(){});
            });
            instance.on("deploy", function(e) { 
                plugin.deploy(e.instance, {}, e.done);
            }); 
            instance.on("destroy", function(e) { 
                destroyInteractive(e.instance, function(){});
            });
            instance.on("cancel", function(e) {
                plugin.cancel(e.instance, function(err) {
                    if (!err) e.done();
                }); 
            });
            return instance;
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("draw", function(){
            // mnuStack = new Menu({
            //     items : [
            //         // @todo fetch these items on draw from the gae api
            //         new MenuItem({ type: "radio", value: "cedar",            caption: "Cedar" }),
            //         new MenuItem({ type: "radio", value: "bamboo-ree-1.8.7", caption: "Bamboo-ree-1.8.7" }),
            //         new MenuItem({ type: "radio", value: "bamboo-mri-1.9.2", caption: "Bamboo-mri-1.9.2" })
            //     ]
            // }, plugin);
            // mnuStack.on("show", function(){
            //     var instance = mnuSettings.meta.instance;
            //     for (var i = 0; i < mnuStack.items.length; i++) {
            //         if (mnuStack.items[i].value == instance.meta.stack)
            //             mnuStack.items[i].checked = true;
            //     }
            // });
            // mnuStack.on("itemclick", function(e) {
            //     var instance = mnuSettings.meta.instance;
            //     lib.changeStack({ 
            //         name : instance.meta.name, 
            //         to   : e.value 
            //     }, function(){});
            // });
            
            mnuSettings = new Menu({
                items: [
                    new MenuItem({ value: "refresh",   caption: "Refresh" }),
                    new MenuItem({ value: "deploylog", caption: "Show Deploy Log" }),
                    new Divider(),
                    new MenuItem({ value: "fork",      caption: "Fork App" }),
                    // new MenuItem({ caption: "Change Stack", submenu: mnuStack }),
                    new MenuItem({ value: "download",  caption: "Download to Workspace" }),
                    new Divider(),
                    new MenuItem({ caption: "Move",    submenu: plugin.createMenu }),
                    // new MenuItem({ value: "addons",    caption: "Manage Add-Ons" })
                ],
            }, plugin);
            
            mnuSettings.on("itemclick", function(e) {
                var instance = mnuSettings.meta.instance;
                if (e.value == "refresh")
                    plugin.update(instance, {}, function(){});
                else if (e.value == "deploylog")
                    plugin.openLog(instance);
                else if (e.value == "fork")
                    fork(instance, function(){});
                else if (e.value == "download")
                    download(instance, function(){});
            })
        });
        plugin.on("afterDestroy", function(e) {
            // If instance was never properly initialized, delete it
            if ((e.args[0] || !e.args[1]) && !e.instance.meta.git)
                return e.instance.unload();
        })
        plugin.on("formHide", function(e) {
            var meta = e.meta;
            var instance = meta.instance;

            // Unload instance to created if the user 
            // presses cancel during the auth process
            if (instance && instance.state == instance.AUTH 
              && meta.kind == "auth" && !instance.meta.url)
                instance.unload();
        })
        plugin.on("unload", function(){
            form && form.unload();
            authform && authform.unload();
            
            form = authform = null;
            
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Google App Engine Plugin for Cloud9
         **/
        plugin.freezePublicAPI({
            get settingsMenu(){ plugin.draw(); return mnuSettings; },
            get createForm(){ return form || createForm(); },
            get authForm(){ return authform || createAuthForm(); },
            
            /**
             *
             */
            Instance: GAEInstance,

            /**
             *
             */
            destroyInteractive: destroyInteractive
        });
        
        register(null, {
            gae: plugin
        });
    }
});