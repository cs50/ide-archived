define(function(require, exports, module) {
    main.consumes = [
        "c9", "ext", "settings", "Form", "DeployTarget",
        "deployinstance", "deploy", "tabManager", "run",
        "Menu", "MenuItem", "Divider", "dialog.confirm"
    ];
    main.provides = ["mongolab"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var ext = imports.ext;
        var Form = imports.Form;
        var DeployTarget = imports.DeployTarget;
        var settings = imports.settings;
        var lib = imports.libheroku;
        var confirm = imports["dialog.confirm"].show;
        var Instance = imports.deployinstance;
        var deploy = imports.deploy;
        var tabs = imports.tabManager;
        var run = imports.run;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;

        var MONGO = options.mongo || "mongo";

        /***** Initialization *****/

        var plugin = new DeployTarget({
            icon: options.staticPrefix + "/mongolab-icon.png",
            caption: "Mongolab",
            position: 200,
            type: "mongolab",
            appmenu: true,
            noauth: true,
            api: {
                create: function(options, callback) {
                    loadApi(function(err, api) {
                        if (err) return callback(err);
                        api.createDatabase(options, function(err, data) {
                            if (data) {
                                var m = data.uri.match(/mongodb:\/\/(.*?):(.*?)@(.*)/);
                                data.user = m[1];
                                data.pass = m[2];
                                data.host = m[3];
                            }
                            callback(err, data);
                        });
                    });
                },
                destroy: function(options, callback) {
                    loadApi(function(err, api) {
                        if (err) return callback(err);
                        options.name = options.name.split("_").pop();
                        api.deleteDatabase(options, callback)
                    });
                },
                getAll: function(options, callback) {
                    loadApi(function(err, api) {
                        if (err) return callback(err);
                        api.listDatabases(function(err, names) {
                            var arr = [], i = 0;
                            while (names && names[i])
                                arr.push(names[i++].split("_").pop());
                            callback(err, arr);
                        })
                    });
                },
                getInfo: function(options, callback){ callback(null, {}); },
                deploy: function(options, callback){callback(null, {}); },
                cancelDeploy: function(options, callback){callback(null, {}); }
            },
            singular: "database",
            plural: "databases"
        }, "Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();

        var mnuSettings, form;

        plugin.__defineGetter__("settingsMenu", function(){
            plugin.draw();
            return mnuSettings;
        });
        plugin.__defineGetter__("createForm", function(){
            return form || createForm();
        });

        var api, queue = [], loadedApi;
        function loadApi(callback) {
            if (loadedApi) {
                if (api)
                    return callback(null, api);
                return queue.push(callback);
            }
            loadedApi = true;

            ext.loadRemotePlugin("mongolab", {
                file: "libmongolab.js",
                redefine: true
            }, function(err, ext) {
                if (err) return callback(err);

                // Make sure this user has an account
                ext.createAccount(function(err, password) {
                    api = ext;
                    queue.forEach(function(q){ q(null, api); });
                    queue = [];
                })
            });

            c9.on("stateChange", function(e) {
                if (e.state & c9.NETWORK)
                    api = null;
                else
                    loadedApi = false;
            });

            queue.push(callback);
        }

        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;

            settings.on("read", function(){
                // var instance = MongolabInstance({ meta: { name: "ruben1" } });
                // deploy.addInstance(instance, "development", plugin);
                // plugin.update(instance, {}, function(){});
            }, plugin);
        }

        /***** Methods *****/

        function openMongoCli(instance) {
            var meta = instance.meta;
            var name = meta.name.split("_").pop();
            var id = instance.type + "_" + name + "_cli";

            var args = [MONGO];
            if (meta.host)
                args.push(meta.host, "-u", meta.user, "-p", meta.pass);
            else
                args.push("ds027628.mongolab.com:27628/" + meta.name);

            // Open output pane to display process
            var tab = tabs.open({
                name: id, // Forcing only a single tab per id
                active: true,
                editorType: "output",
                document: {
                    title: name + " - MongoDB Shell",
                    tooltip: name + " - MongoDB Shell",
                    output: { id : id, hidden : true }
                }
            }, function(){});

            // Start MongoDB Shell
            run.run({
                cmd: args
            }, {}, id, function(err, pid) {
                tab.classList.remove("loading");
                tab.document.getSession().show();
            });

            tab.classList.add("loading");
        }

        //@todo .btncontainer shadow, remove from terminal and ace:
        // 0 -1px 0 0 black inset, 0 1px 0 0 rgba(255, 255, 255, .06) inset, 0 1px 0 rgba(255,255,255,0.06)
        function openDashboard(){
            loadApi(function(err, api) {
                api.getDashboardUrl(function(err, url) {
                    tabs.open({
                        name: "mongolab-dashboard", // Forcing only a single tab per id
                        active: true,
                        editorType: "urlview",
                        document: {
                            title: "Mongolab Dashboard",
                            value: url,
                            urlview: {
                                backgroundColor: "#3d3d3d",
                                dark: true
                            }
                        }
                    }, function(){});
                });
            });
        }

        var caption = {
            creating: "Creating Mongolab Database...",
            error: "Error",
            idle: "Ready.",
            deploying: "Deploying...",
            auth: "Authentication is Required",
            working: "Starting...",
            deleting: "Deleting..."
        }
        function render(htmlNode, instance) {
            var meta = instance.meta;

            var html = ""
                + "<span class='state'>" + caption[instance.state] + "</span>"
                + "<span class='title' title='" + (meta.name || "") + "'>Mongo DB: "
                    + (meta.name.split("_").pop()) + "</span>"
                // + "<span class='last-deploy'>" + (meta.lastDeploy
                //     ? "Deployed at " + new Date(meta.lastDeploy).toLocaleString()
                //     : "Not Deployed Yet") + "</span>";

            if (instance.state != "creating")
                html += "<span class='shell'>[Shell]</span>";
            if (meta.uri) {
                html +=
                    "<span class='user'><strong>Username:</strong> " + meta.user + "</span>"
                    + "<span class='pass'><strong>Password:</strong> " + meta.pass + "</span>"
                    + "<span class='host'><strong>Host:</strong> " + meta.host + "</span>";
            }

            htmlNode.innerHTML = html;

            htmlNode.querySelector(".title").onclick = function(){
                openDashboard();
            }
            var node = htmlNode.querySelector(".shell")
            if (node)
                node.onclick = function(){
                    openMongoCli(instance)
                };
        }

        function destroyInteractive(instance, callback) {
            var name = instance.meta.name.split("_").pop();
            confirm(
                "Delete MongoDB '" + name + "'?",
                "Are you sure you want to delete the MongoDB '" + name + "'?",
                "This will delete the database '" + name
                    + "', including all data. This cannot be undone!",
                function(){
                    plugin.destroy(instance, callback);
                }, function(){
                    callback(null, false);
                });
        }

        function createForm(){
            // Database Create Form
            form = new Form({
                edge: "3",
                rowheight: 30,
                colwidth: 70,
                className: "deploy-form",
                style: "padding:10px;background-color:rgb(13, 43, 66)",
                form: [
                    {
                        type: "image",
                        src: options.staticPrefix + "/mongolab-logo.png",
                        width: 180,
                        height: 47
                    },
                    {
                        title: "DB Name",
                        name: "name",
                        type: "textbox",
                        height: "27",
                        edge: "3 3 8 3",
                        rowheight: 35
                    },
                    {
                        title: "Admin Name",
                        name: "username",
                        type: "textbox",
                        height: "27",
                        edge: "3 3 8 3",
                        rowheight: 35
                    },
                    {
                        title: "Admin Pass",
                        name: "password",
                        type: "password",
                        height: "27",
                        edge: "3 3 8 3",
                        rowheight: 35
                    },
                    {
                        title: "Plan",
                        name: "plan",
                        type: "dropdown",
                        items: [
                            { value: "sandbox", caption: "Sandbox" },
                            { value: "single-node", caption: "Single-node" },
                            { value: "cluster", caption: "Cluster" },
                            { value: "mini", caption: "Mini" },
                            { value: "x-small", caption: "X-Small" },
                            { value: "small", caption: "Small" },
                            { value: "medium", caption: "Medium" },
                            { value: "large", caption: "Large" },
                            { value: "x-large", caption: "X-Large" }
                        ],
                        defaultValue: "sandbox"
                    },
                    {
                        title: "Cloud",
                        name: "cloud",
                        type: "dropdown",
                        items: [
                            { value: "AWS_us-east-1", caption: "Amazon US East" },
                            { value: "AWS_eu-west-1", caption: "Amazon EU West" },
                            { value: "RSC_DFW", caption: "Rackspace" }
                        ],
                        defaultValue: "AWS_us-east-1"
                    },
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

        function MongolabInstance(options) {
            options.menu = plugin.settingsMenu;
            options.type = "mongolab";
            options.button = "Import Now";

            var instance = new Instance(options);
            instance.on("render", function(e) {
                render(e.htmlNode, e.instance);
                return false;
            });
            instance.on("deploy", function(e) {
                plugin.deploy(e.instance, {}, e.done);
            });
            instance.on("destroy", function(e) {
                destroyInteractive(e.instance, function(){});
            });
            instance.on("cancel", function(e) {
                plugin.cancel(e.instance, e.done);
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
                    new MenuItem({ value: "deploylog", caption: "Show Deploy Log" }),
                    new Divider(),
                    new MenuItem({ value: "export_local",  caption: "Export to MongoDB in Workspace" }),
                    new MenuItem({ value: "export_file",  caption: "Export to File" }),
                    new Divider(),
                    new MenuItem({ caption: "Move",    submenu: plugin.createMenu }),
                ],
            }, plugin);

            mnuSettings.on("itemclick", function(e) {
                var instance = mnuSettings.meta.instance;
                if (e.value == "deploylog")
                    plugin.openLog(instance);
                // else if (e.value == "import")
                //     plugin.openLog(instance);
            })
        });
        plugin.on("afterDestroy", function(e) {
            // If instance was never properly initialized, delete it
            if ((e.args[0] || !e.args[1]) && !e.instance.meta.uri)
                return e.instance.unload();
        })
        plugin.on("unload", function(){
            form && form.unload();

            form = null;

            loaded = false;
        });

        /***** Register and define API *****/

        /**
         * Mongolab Plugin for Cloud9
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            Instance: MongolabInstance,

            /**
             *
             */
            destroyInteractive: destroyInteractive
        });

        register(null, {
            mongolab: plugin
        });
    }
});