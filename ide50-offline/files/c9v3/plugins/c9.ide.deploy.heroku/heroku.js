define(function(require, exports, module) {
    main.consumes = [
        "settings", "libheroku", "Form", "DeployTarget", "c9", "dialog.confirm",
        "deployinstance", "deploy", "dashboard", "proc", "tabManager", 
        "Menu", "MenuItem", "Divider", "dialog.alert"
    ];
    main.provides = ["heroku"];
    return main;

    // @todo download and fork should go via the deploy log
    // @todo install heroku if it's not there
    // @todo preconditions check (git, procfile)
    // @todo procfile ui?
    // @todo during login/creation there should be a spinner and the form needs to be disabled
    // @todo offline detection and handling
    // @todo have run clean up the .watch files
    // @todo create a tmux library to deal with terminal, output, run use of tmux
    // @todo the dashboard will have the app log
    // @todo Add option to enable the heroku database
    //        @todo item for the default database
    //            heroku addons:add heroku-postgresql:dev
    //            heroku pg:wait
    //            heroku config | grep HEROKU_POSTGRESQL
    //            HEROKU_POSTGRESQL_RED_URL: postgres://user3123:passkja83kd8@ec2-117-21-174-214.compute-1.amazonaws.com:6212/db982398
    //            heroku pg:promote HEROKU_POSTGRESQL_RED_URL
               
    //            Import:
    //            https://devcenter.heroku.com/articles/heroku-postgres-import-export#import

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Form = imports.Form;
        var DeployTarget = imports.DeployTarget;
        var dashboard = imports.dashboard;
        var settings = imports.settings;
        var lib = imports.libheroku;
        var alert = imports["dialog.alert"].show;
        var confirm = imports["dialog.confirm"].show;
        var Instance = imports.deployinstance;
        var deploy = imports.deploy;
        var proc = imports.proc;
        var tabs = imports.tabManager;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;

        var PATH = require("path");
        
        var HEROKU = lib.HEROKU;
        var BASEPATH = lib.BASEPATH;
        
        /***** Initialization *****/
        
        var plugin = new DeployTarget({
            icon: options.staticPrefix + "/heroku-icon2.png",
            caption: "Heroku",
            position: 100,
            type: "heroku",
            appmenu: true,
            api: lib,
            singular: "app",
            plural: "apps"
        }, "Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var mnuSettings, authform, form, herokuDashboard;

        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            dashboard.registerProvider({
                name: "Heroku",
                logo: "plugins/c9.ide.dashboard/images/heroku.png"
            });
            dashboard.register("heroku_logs", "Heroku", "Access and Error Logs", { 
                type: "output", title: "Access and Error Logs"
            }, function(){
                var form = new Form({
                    edge: "3 3 8 3",
                    rowheight: 35,
                    colwidth: 50,
                    style: "padding:10px;",
                    form: [
                        {
                            title: "App",
                            name: "name",
                            type: "dropdown",
                            "empty-message": "Loading Apps..."
                        }
                    ]
                });
                
                form.on("show", function(){
                    lib.getAll({}, function(err, names) {
                        if (err) return;
                        var items = names.map(function(name) {
                            return { value: name, caption: name };
                        });
                        
                        var dropdown = {
                            id: "name",
                            items: items
                        };
                        
                        if (form.meta.dashboard) {
                            var state = form.meta.dashboard.getState(form.meta.dashboard.activeDocument);
                            if (state.type == "heroku")
                                dropdown.value = state.app;
                        }
                        
                        form.update([dropdown]);
                    })
                });
                
                form.on("serialize", function(e) {
                    return {
                        id: e.json.name,
                        title: e.json.title,
                        run: {
                            runner: { cmd: ["heroku", "logs", "-t", "-a", e.json.name] },
                            options: {}
                        }
                    };
                });
                
                return form;
            });
            
            dashboard.register("heroku_cli", "Heroku", "Heroku CLI", function(context) {
                var evaluator = {
                    name: context.name,
                    canEvaluate: function(str) { return !!str.trim(); },
                    evaluate: function(str, cell, cb) {
                        // Ignore heroku command if typed
                        str = str.replace(/^heroku\s+/, "");
                        
                        // cell.addWidget({rowCount: 6, html:"<img src='http://martin.bravenboer.name/logo-trans-85.png'>"})
                        // cell.addWidget({rowCount: 8, el:editor.container, editor: editor})
                        
                        var session = cell.session;
                        var args = str.trim().split(" ");
                        if (evaluator.name && str.indexOf("-a") == -1)
                            args.push("-a", evaluator.name);
                        
                        proc.pty(HEROKU, {
                            args: args,
                            cwd: BASEPATH,
                            env: { "GEM_PATH": "~/.c9/lib/" }
                        }, function(err, pty) {
                            session.process = pty;
                            
                            var buffer = "";
                            pty.on("data", function ondata(data) {
                                if (data.indexOf("Enter your Heroku credentials") > -1) {
                                    plugin.auth();
                                    cb("Authorization Required");
                                    pty.kill();
                                    pty.off("data", ondata);
                                    return;
                                }
                                
                                if (args[0] != "apps:info") {
                                    // Parse out pty stuff for now
                                    data = data.replace(//g, "").replace(/\[\d+\w/g, "");
                                    
                                    cell.insert(data);
                                }
                                else buffer += data;
                            })
                            pty.on("error", function(data) {
                                //cell.addWidget({rowCount: 6, html:"<span class='error'>" + data + "</span>"});
                                cell.insert(pos, "Error: " + data);
                            })
                            pty.on("exit", function(){
                                if (args[0] == "apps:info") {
                                    var table = "<table class='herokuinfo' cellpadding='0' cellspacing='0'>", found, rows = 2;
                                    buffer.split("\n").forEach(function(line) {
                                        var pair = line.split(":");
                                        if (pair.length > 1) {
                                            var title = pair.shift();
                                            var content = pair.join(":").trim();
                                            if (content.indexOf("http") > -1) {
                                                content = "<a href='" + content 
                                                    + "' target='_blank'>"
                                                    + content + "</a>";
                                            }
                                            
                                            table += "<tr><th>" + title 
                                                + ": </th><td>" + content
                                                + "</td></tr>";
                                            rows++;
                                            found = true;
                                        }
                                        else if (line.trim()) {
                                            table += "<tr><th colspan='2' class='name'>" 
                                                + line.replace(/=+/, "") + "</th></tr>";
                                        }
                                    });
                                    
                                    if (!found) cb(buffer)
                                    else {
                                        cell.addWidget({rowCount: rows, html:table});
                                    }
                                }
                                
                                delete session.process;
                                cell.setWaiting(false);
                            })
                        });
                    }
                };
                
                return {
                    type: "ace.repl", title: "Heroku CLI", //cannot make this a percentage
                    "ace.repl": { 
                        mode: "ace/mode/text", 
                        evaluator: evaluator, 
                        message: "Welcome to the Heroku CLI. The heroku command is optional. Type 'apps<enter>' to see all your apps."
                    }
                }
            }, function(context) {
                if (context.type == "heroku")
                    return false;
                
                var form = new Form({
                    edge: "3 3 8 3",
                    rowheight: 35,
                    colwidth: 50,
                    style: "padding:10px;",
                    form: [
                        {
                            title: "App",
                            name: "name",
                            type: "dropdown",
                            "empty-message": "Loading Apps..."
                        }
                    ]
                });
                
                form.on("show", function(){
                    lib.getAll({}, function(err, names) {
                        if (err) return;
                        
                        var items = names.map(function(name) {
                            return { value: name, caption: name };
                        });
                        
                        var dropdown = {
                            id: "name",
                            items: items
                        };
                        
                        if (form.meta.dashboard) {
                            var state = form.meta.dashboard.getState(form.meta.dashboard.activeDocument);
                            if (state.type == "heroku")
                                dropdown.value = state.app;
                                //state["ace.repl"].evaluator.name = 
                        }
                        
                        form.update([dropdown]);
                    })
                });
                
                return form;
            });
            
            function newrelic(context) {
                if (context.type == "newrelic")
                    return false;
                
                var form = new Form({
                    edge: "3 3 8 3",
                    rowheight: 35,
                    colwidth: 50,
                    style: "padding:10px;",
                    form: [
                        {
                            type: "submit",
                            caption: "Install New Relic Agent"
                        }
                    ]
                });
                
                return form;
            }
            
            dashboard.registerProvider({
                name: "Google Analytics",
                logo: "plugins/c9.ide.dashboard/images/googleanalytics.png"
            });
            dashboard.register("gae_visitors", "Google Analytics", "Unique Visitors", 
                { type: "urlview", title: "Unique Visitors", urlview: { value : "/static/charts/examples/line-basic/index.htm" } })
            dashboard.register("gae_pageviews", "Google Analytics", "Tab Views",
                { type: "urlview", title: "Tab Views", urlview: { value : "/static/charts/examples/line-basic/index.htm" } })
            
            dashboard.registerProvider({
                name: "New Relic",
                logo: "plugins/c9.ide.dashboard/images/newrelic.png"
            });
            dashboard.register("newrelic_slowqueries", "New Relic", "Slow Queries",
                { type: "urlview", title: "CPU Usage", urlview: { value : "/static/charts/examples/line-basic/index.htm" } }, newrelic)
            dashboard.register("newrelic_requests", "New Relic", "Requests",
                { type: "urlview", title: "Concurrent Connections", urlview: { value : "/static/charts/examples/line-basic/index.htm" } }, newrelic)
            dashboard.register("newrelic_connections", "New Relic", "Connections",
                { type: "urlview", title: "Memory Usage", urlview: { value : "/static/charts/examples/line-basic/index.htm" } }, newrelic);
            
            dashboard.registerProvider({
                name: "Data Dog",
                logo: "plugins/c9.ide.dashboard/images/datadog.png"
            });
            dashboard.register("datadog_cpu", "Data Dog", "CPU Usage",
                { type: "urlview", title: "CPU Usage", urlview: { value : "/static/charts/examples/line-basic/index.htm" } })
            dashboard.register("datadog_connections", "Data Dog", "Concurrent Connections",
                { type: "urlview", title: "Concurrent Connections", urlview: { value : "https://app.datadoghq.com/graph/embed?token=e04e67bb0d1a1c9dec9782616b258222b71ee2b640f056b8a08b1ede72980cd3&height=300&width=400" } })
            dashboard.register("datadog_memory", "Data Dog", "Memory Usage",
                { type: "urlview", title: "Memory Usage", urlview: { value : "/static/charts/examples/line-basic/index.htm" } })
            
            herokuDashboard = dashboard.create({
                name: "herokudashboard",
                caption: "Heroku Dashboard",
                className: "herokudb",
                configurable: true,
                heading: {
                    dark: true,
                    height: 59,
                    logo: options.staticPrefix + "/heroku-logo.png",
                    className: "herokunav",
                    backgroundColor: "#29264d"
                },
                widgets: { type: "vsplit", nodes: [
                    // { type: "hsplit", nodes: [
                        // { type: "vsplit", width: "30%", nodes: [
                        //     { id: "gae_visitors", height: "50%" },
                        //     { id: "gae_pageviews" }
                        // ]},
                        // { type: "vsplit", nodes: [
                            // { type: "hsplit", height: "30%", nodes: [
                            //     { id: "newrelic_cpu" },
                            //     { type: "hsplit", width: "66%", nodes: [
                            //         { id: "newrelic_connections", width: "50%"},
                            //         { id: "newrelic_memory" }
                            //     ]}
                            // ]},
                            { id: "heroku_logs" },
                        // ]}
                    // ]},
                    { id: "heroku_cli", height: "20%" }
                ]}
            });
            
            settings.on("read", function(){
                // var instance = HerokuInstance({ meta: { name: "rubendaniels" } });
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
                
                var forked = new HerokuInstance({ meta: data });
                deploy.addInstance(forked, instance.where || "development", plugin);
                plugin.update(forked, {}, function(){});
                
                instance.state = instance.IDLE;
                callback(null, forked);
            });
        });
        
        var caption = {
            creating: "Creating Heroku App...",
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
                name: name + "_herokudashboard", // Forcing only a single tab per id
                editorType: "herokudashboard",
                active: true,
                document: {
                    title: name + " - Heroku Dashboard",
                    tooltip: name + " - Heroku Dashboard",
                    herokudashboard: {
                        app: name,
                        type: "heroku",
                        output: {
                            id: "heroku_" + name + "-log",
                            run: {
                                runner: { cmd: ["heroku", "logs", "-t", "-a", name] },
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
                style: "padding:10px;background-color:#29264d;",
                form: [
                    {
                        type: "image",
                        src: options.staticPrefix + "/heroku-logo.png",
                        width: 180,
                        height: 58
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
                style: "padding:10px;background-color:#29264d;",
                form: [
                    {
                        type: "image",
                        src: options.staticPrefix + "/heroku-logo.png",
                        width: 180,
                        height: 58
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
                    //         // @todo fetch these items on draw from the heroku api
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

        function HerokuInstance(options) {
            options.menu = plugin.settingsMenu;
            options.type = "heroku";

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
            //         // @todo fetch these items on draw from the heroku api
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
         * Heroku Plugin for Cloud9
         **/
        plugin.freezePublicAPI({
            get settingsMenu(){ plugin.draw(); return mnuSettings; },
            get createForm(){ return form || createForm(); },
            get authForm(){ return authform || createAuthForm(); },
            
            /**
             *
             */
            Instance: HerokuInstance,

            /**
             *
             */
            destroyInteractive: destroyInteractive
        });
        
        register(null, {
            heroku: plugin
        });
    }
});