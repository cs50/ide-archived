define(function(require, exports, module) {
    main.consumes = [
        "settings", "libopenshift", "Form", "DeployTarget", 
        "deployinstance", "deploy", "run", "tabManager", "Menu", "MenuItem", 
        "Divider", "dialog.alert", "dialog.confirm"
    ];
    main.provides = ["openshift"];
    return main;

    function main(options, imports, register) {
        var Form = imports.Form;
        var DeployTarget = imports.DeployTarget;
        var settings = imports.settings;
        var lib = imports.libopenshift;
        var alert = imports["dialog.alert"].show;
        var confirm = imports["dialog.confirm"].show;
        var Instance = imports.deployinstance;
        var deploy = imports.deploy;
        var run = imports.run;
        var tabs = imports.tabManager;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        
        var RHC = options.rhc || "rhc";
        
        /***** Initialization *****/
        
        var plugin = new DeployTarget({
            icon: options.staticPrefix + "/openshift-icon.png",
            caption: "Openshift",
            position: 50,
            type: "openshift",
            appmenu: true,
            api: lib,
            singular: "app",
            plural: "apps"
        }, "Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var mnuSettings, authform, form;

        plugin.__defineGetter__("settingsMenu", function(){ 
            plugin.draw(); 
            return mnuSettings; 
        });
        plugin.__defineGetter__("createForm", function(){ 
            return form || createForm(); 
        });
        plugin.__defineGetter__("authForm", function(){ 
            return authform || createAuthForm(); 
        });
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            settings.on("read", function(){
                // var instance = OpenshiftInstance({ meta: { name: "ruben" } });
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
        
        function ssh(instance, callback) {
            var meta = instance.meta;
            var name = meta.name.split("_").pop();
            var id = instance.type + "_" + name + "_cli";
            
            var args = [RHC];
            args.push("ssh", "-a", meta.name);
            
            // Open output pane to display process
            var tab = tabs.open({
                name: id, // Forcing only a single tab per id
                active: true,
                editorType: "output",
                document: {
                    title: name + " - OpenShift SSH",
                    tooltip: name + " - OpenShift SSH",
                    output: { id : id, hidden : true }
                }
            }, function(){});
            
            // Start SSH Session
            run.run({
                cmd: args
            }, {}, id, function(err, pid) {
                tab.classList.remove("loading");
                tab.document.getSession().show();
            });
            
            tab.classList.add("loading");
        }
        
        var start = plugin.wrap("start", function(instance, callback) {
            instance.state = "starting";
            
            var name = instance.meta.name;
            lib.start({ name: name }, function(err, success) {
                if (err)
                    return callback(err);
                
                instance.state = instance.IDLE;
                callback(null, true);
            });
        });
        
        var restart = plugin.wrap("restart", function(instance, callback) {
            instance.state = "restarting";
            
            var name = instance.meta.name;
            lib.restart({ name: name }, function(err, success) {
                if (err)
                    return callback(err);
                
                instance.state = instance.IDLE;
                callback(null, true);
            });
        });
        
        var stop = plugin.wrap("stop", function(instance, callback) {
            instance.state = "stopping";
            
            var name = instance.meta.name;
            lib.stop({ name: name }, function(err, success) {
                if (err)
                    return callback(err);
                
                instance.state = instance.IDLE;
                callback(null, true);
            });
        });
        
        var caption = {
            creating: "Creating Openshift App...",
            error: "Error",
            idle: "Ready.",
            deploying: "Deploying...",
            auth: "Authentication is Required",
            working: "Processing...",
            deleting: "Deleting...",
            starting: "Starting...",
            stopping: "Stopping...",
            restarting: "Restarting...",
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
                + "<span class='ssh'>[SSH]</span>"
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
            
            htmlNode.querySelector(".ssh").onclick = function(){
                ssh(instance, function(){});
            }
            
            if (instance.state == instance.AUTH)
                htmlNode.firstChild.onclick = function(){ 
                    plugin.auth(instance);
                };
        }

        // This is a non-reversible action! Your application code and data will 
        // be permanently deleted if you continue!
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

        function createAuthForm(){
            authform = new Form({
                edge: "3 3 8 3",
                rowheight: 35,
                colwidth: 70,
                className: "deploy-form",
                style: "padding:10px;\
                    background: #333;\
                    background-image: -webkit-linear-gradient(top,rgba(0, 0, 0, 0.29) 0%, rgba(0, 0, 0, 0.11) 8px, rgba(0, 0, 0, 0.01) 13px, transparent 15px), url(" + options.staticPrefix + "/bg.png);\
                    background-position: 0 0, 280px bottom;",
                form: [
                    {
                        type: "image",
                        src: options.staticPrefix + "/openshift-logo.png",
                        width: 180,
                        height: 31,
                        margin: "2 0 8 3"
                    },
                    {
                        title: "Username",
                        name: "username",
                        type: "textbox",
                        height: 27
                    },
                    {
                        title: "Password",
                        name: "password",
                        type: "password",
                        height: 27
                    },
                    {
                        name: "loginfail",
                        type: "label",
                        caption: "Could not login. Please try again.",
                        style: "color:rgb(255, 143, 0);margin-left:5px;"
                    },
                    {
                        type: "submit",
                        caption: "Login",
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
                style: "padding:10px;\
                    background: #333;\
                    background-image: -webkit-linear-gradient(top,rgba(0, 0, 0, 0.29) 0%, rgba(0, 0, 0, 0.11) 8px, rgba(0, 0, 0, 0.01) 13px, transparent 15px), url(" + options.staticPrefix + "/bg.png);\
                    background-position: 0 0, 280px bottom;",
                form: [
                    {
                        type: "image",
                        src: options.staticPrefix + "/openshift-logo.png",
                        width: 180,
                        height: 31,
                        margin: "2 0 8 3"
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
                        title: "Domain",
                        name: "domain",
                        type: "textbox",
                        message: "Leave empty for the default domain",
                        height: "27",
                        edge: "3 3 8 3",
                        rowheight: 35
                    },
                    {
                        title: "Size",
                        name: "size",
                        type: "dropdown",
                        items: [
                            // @todo fetch these items on draw from the openshift api
                            { value: "small",  caption: "Small (512 MB RAM / 1GB Disk)" },
                            { value: "medium", caption: "Medium (1 GB RAM / 1GB Disk)" }
                        ],
                        defaultValue: "small"
                    },
                    {
                        title: "Type",
                        name: "type",
                        type: "dropdown",
                        items: [
                            { value: "diy-0.1",      caption: "Do-It-Yourself" },
                            { value: "jbossas-7",    caption: "JBoss Application Server 7.1" },
                            { value: "jbosseap-6.0", caption: "JBoss Enterprise Application Platform 6.0" },
                            { value: "jenkins-1.4",  caption: "Jenkins Server 1.4" },
                            { value: "nodejs-0.6",   caption: "Node.js 0.6" },
                            { value: "perl-5.10",    caption: "Perl 5.10" },
                            { value: "php-5.3",      caption: "PHP 5.3" },
                            { value: "python-2.6",   caption: "Python 2.6" },
                            { value: "python-2.7",   caption: "Python 2.7 Community Cartridge" },
                            { value: "python-3.3",   caption: "Python 3.3 Community Cartridge" },
                            { value: "ruby-1.8",     caption: "Ruby 1.8" },
                            { value: "ruby-1.9",     caption: "Ruby 1.9" },
                            { value: "jbossews-1.0", caption: "Tomcat 6 (JBoss EWS 1.0)" },
                            { value: "jbossews-2.0", caption: "Tomcat 7 (JBoss EWS 2.0)" },
                            { value: "zend-5.6",     caption: "Zend Server 5.6" }
                        ],
                        defaultValue: "diy-0.1"
                    },
                    {
                        type: "checkbox",
                        title: "Auto-Scaling",
                        name: "scaling"
                    },
                    {
                        type: "checkbox",
                        title: "Jenkins",
                        name: "jenkins"
                    },
                    {
                        type: "submit",
                        caption: "Create",
                        "default" : true,
                        submenu: plugin.createMenu,
                        margin: "10 20 5 20"
                    }
                ]
            });
            return form;
        }

        function OpenshiftInstance(options) {
            options.menu = plugin.settingsMenu;
            options.type = "openshift";

            var instance = new Instance(options);
            instance.on("render", function(e) { 
                render(e.htmlNode, e.instance);
                return false; //disable rename
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
            mnuSettings = new Menu({
                items: [
                    new MenuItem({ value: "refresh",   caption: "Refresh" }),
                    new MenuItem({ value: "deploylog", caption: "Show Deploy Log" }),
                    new Divider(),
                    new MenuItem({ value: "start",   caption: "Start" }),
                    new MenuItem({ value: "stop",    caption: "Stop" }),
                    new MenuItem({ value: "restart", caption: "Restart" }),
                    new Divider(),
                    new MenuItem({ value: "download",  caption: "Download to Workspace" }),
                    new Divider(),
                    new MenuItem({ caption: "Move",    submenu: plugin.createMenu }),
                    // new MenuItem({ value: "cartridges",    caption: "Cartridges" })
                ],
            }, plugin);
            
            mnuSettings.on("show", function(){
                var name = mnuSettings.meta.instance.meta.name;
                var items = mnuSettings.items;
                
                items[3].disabled = items[4].disabled = items[5].disabled = 0;
                
                lib.getState({ name: name }, function(err, state) {
                    items[3].disabled = state == "started";
                    items[4].disabled = state == "stopped";
                    items[5].disabled = state == "stopped";
                });
            });
            
            mnuSettings.on("itemclick", function(e) {
                var instance = mnuSettings.meta.instance;
                if (e.value == "refresh")
                    plugin.update(instance, {}, function(){});
                else if (e.value == "deploylog")
                    plugin.openLog(instance);
                else if (e.value == "download")
                    download(instance, function(){});
                else if (e.value == "start")
                    start(instance, function(){});
                else if (e.value == "stop")
                    stop(instance, function(){});
                else if (e.value == "restart")
                    restart(instance, function(){});
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
         * Openshift Plugin for Cloud9
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            Instance: OpenshiftInstance,

            /**
             *
             */
            destroyInteractive: destroyInteractive
        });
        
        register(null, {
            openshift: plugin
        });
    }
});