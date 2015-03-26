/**
 * Editor object for the Cloud9
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "settings", "deploy", "console", "Menu", "MenuItem"
    ];
    main.provides = ["DeployTarget"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var deploy = imports.deploy;
        var console = imports.console;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        
        var uCaseFirst = require("c9/string").uCaseFirst;
        
        /**
         * Deploy Target
         * 
         * @property fileExtensions {String[]} Array of file extensions supported by this editor
         * 
         * @event documentLoad Fires when a document is loaded into the editor.
         *   This event is also fired when this document is attached to another
         *   instance of the same editor (in a split view situation). Often you
         *   want to keep the session information partially in tact when this
         *   happens.
         * @param {Object} e
         *     doc    {Document} the document that is loaded into the editor
         *     state  {Object} state that was saved in the document
         */
         function DeployTarget(options, developer, deps) {
            // Target extends ext.Plugin
            Plugin.call(this, developer, deps);

            // Get a reference to the event emitter
            var plugin = this;
            var emit = plugin.getEmitter();
            //emit.setMaxListeners(1000);
            
            var menu, authform, form, loginfail, lastAuthError;
            
            var icon = options.icon;
            var caption = options.caption;
            var position = options.position;
            var type = options.type;
            var appmenu = options.appmenu;
            var api = options.api;
            var singular = options.singular;
            var plural = options.plural;
            var noauth = options.noauth;

            var loaded = false;
            function load(){
                if (loaded) return false;
                loaded = true;
                
                deploy.on("formHide", function(e) {
                    lastAuthError = null;
                
                    var meta = e.meta;
                    if (!meta || meta.type != type)
                        return;

                    if (meta.type == type)
                        emit("formHide", e);
                });

                deploy.register(plugin);
                
                // Deploy Menu
                var mnuDeploy = deploy.mnuDeploy;
                mnuDeploy.append(new MenuItem({
                    caption: caption,
                    icon: "http://" + location.host + "/static/" + icon,
                    position: position,
                    onclick: function(){ deploy.showForm(getForm()); }
                }, plugin));
                
                // Create Menu
                menu = new Menu({
                    items: [
                        new MenuItem({ value: "development", caption: "As Development Instance" }),
                        new MenuItem({ value: "testing",     caption: "As Testing Instance" }),
                        new MenuItem({ value: "staging",     caption: "As Staging Instance" }),
                        new MenuItem({ value: "production",  caption: "As Production Instance" })
                    ]
                }, plugin);
                
                menu.on("show", function(e) {
                    menu.meta.instance = menu.opener
                        ? menu.opener.menu.meta.instance || menu.opener.caption
                        : null;
                });
                menu.on("itemclick", function(e) {
                    var name = menu.meta.instance;
                    if (!name || typeof name == "string") {
                        var instance = new plugin.Instance({
                            type: type,
                            meta: name
                                ? { name : name }
                                : form.toJson()
                        });
    
                        deploy.addInstance(instance, e.value, plugin);
                        deploy.hideForm();
    
                        if (name)
                            plugin.update(instance, {}, function(){});
                        else
                            plugin.create(instance, {}, function(){});
                    }
                    else if (name) {
                        deploy.moveInstance(name, e.value);
                    }
                });
            
                // Deploy Pref Sub Menu
                if (!noauth || appmenu) {
                    var mnuTargetPrefs = new Menu({}, plugin);
                    if (!noauth) {
                        mnuTargetPrefs.append(new MenuItem({ caption: "Login", value: "login" }));
                        mnuTargetPrefs.append(new MenuItem({ caption: "Logout", value: "logout" }));
                    }
                    
                    mnuTargetPrefs.on("itemclick", function(e) {
                        if (e.value == "login") {
                            deploy.showForm(getAuthForm());
                        }
                        else if (e.value == "logout") {
                            plugin.logout(function(){});
                        }
                    });
                    
                    // Optional Import of Existing Instances
                    if (appmenu !== false) {
                        var mnuApps = new Menu({}, plugin);
                        mnuApps.on("show", function(e){ refreshAppMenu(mnuApps); });
                        mnuTargetPrefs.append(new MenuItem({ 
                            caption: "Import", 
                            submenu: mnuApps
                        }));
                    }
                    
                    // Deploy Preference Menu
                    var mnuPrefs = deploy.mnuPrefs;
                    mnuPrefs.append(new MenuItem({
                        caption: caption,
                        submenu: mnuTargetPrefs,
                        position: 1000,
                    }), plugin);
                }
            }
            
            var drawn = false;
            function draw(opts) {
                if (drawn) return;
                drawn = true;
                
                emit("draw");
            }

            function refreshAppMenu(mnuApps) {
                draw(); // Make sure anything relevant id drawn
                
                // Remove all items
                var nodes = mnuApps.items;
                for (var i = nodes.length - 1; i >= 0; i--)
                    nodes[i].unload();
                
                var loading = mnuApps.append(new MenuItem({
                    caption: "Loading " + uCaseFirst(plural) + "...",
                    disabled: true
                }));
                
                var existing = deploy.getAll(type).map(function(instance) {
                    return instance.meta.name;
                });
                
                getAll(function(err, names) {
                    loading.unload();
                    
                    var found;
                    (names || []).forEach(function(name) {
                        if (existing.indexOf(name) > -1)
                            return;
                        
                        found = true;
                        mnuApps.append(new MenuItem({
                            caption: name,
                            submenu: menu
                        }));
                    });
                    
                    if (!found) {
                        mnuApps.append(new MenuItem({
                            caption: err 
                                ? err && err.message || err
                                : "You don't have any " + plural + " to import",
                            disabled: true
                        }));
                    }
                });
            }
            
            /***** Methods *****/
            
            function wrap(name, fn) {
                return function(instance, options, callback) {
                    function next(){ fn(instance, options, callback) }

                    var args = Array.prototype.slice.call(arguments, 0);
                    var cb = args.pop(); // Remove old callback

                    if (emit("before" + name, { 
                        instance: instance,
                        options: typeof options == "object" ? options : {}, 
                        next: next,
                        callback: cb
                    }) === false)
                        return;

                    // Add new callback wrapper
                    args.push(function(err) {
                        if (err) {
                            instance && instance.log.add("error", err);
                        
                            if (options.noauth || err.code != 100)
                                emit("error", { type: name, instance: instance });

                            if (err.code == 100) {
                                if (instance) 
                                    instance.state = instance.AUTH;
                                lastAuthError = next;
                                
                                if (!options.noauth)
                                    auth(instance);
                            }
                            else if (instance) {
                                instance.state = instance.ERROR;
                            }
                        }
                        
                        emit("after" + name, { 
                            instance: instance,
                            args: arguments,
                            err: err
                        });

                        cb.apply(window, arguments);
                    });

                    fn.apply(this, args);
                }
            }

            function create(instance, options, callback) {
                draw();
                
                function cb(err, data) {
                    if (err)
                        return callback(err);
                    
                    instance.update(data);
                    instance.state = instance.IDLE;
                    
                    callback(null, instance);
                }
                
                instance.state = instance.CREATING;
                api.create(instance.meta, cb);
            }
            
            function update(instance, options, callback) {
                draw();
                
                function cb(err, data) {
                    if (err)
                        return callback(err);
                    
                    instance.update(data);
                    instance.state = instance.IDLE;
                    
                    callback(null, instance);
                }
                
                instance.state = instance.WORKING;
                api.getInfo(instance.meta, cb);
            }
            
            function rename(instance, options, callback) {
                instance.state = instance.WORKING;
                
                api.rename(options, function(err, data) {
                    if (err)
                        return callback(err);
                    
                    instance.update(data);
                    instance.state = instance.IDLE;
                    
                    callback(null, instance);
                });
            }
            
            function login(instance, options, callback) {
                api.login(options, function(err, success) {
                    if (err || !success) {
                        loginfail.show();
                        deploy.showForm(authform);
                        lastAuthError = null;
                        return callback(err, false);
                    }
                    
                    var instance = authform.meta && authform.meta.instance;
                    if (lastAuthError) {
                        lastAuthError();
                        lastAuthError = null;
                    }
                    else if (instance)
                        instance.state = instance.IDLE;
                    
                    deploy.getAll(type).forEach(function(instance) {
                        if (instance.state == instance.AUTH) {
                            update(instance, { noauth: true }, function(){});
                        }
                    });

                    callback(null, true);
                    
                    deploy.hideForm();
                });
            }
            
            function logout(callback) {
                api.logout({}, function(){
                    deploy.getAll(type).forEach(function(instance) {
                        instance.state = instance.AUTH;
                    });
                    
                    callback.apply(this, arguments);
                });
            }
            
            function deployNow(instance, options, callback) {
                instance.state = instance.DEPLOYING;
                
                var tab;
                
                api.deploy({
                    meta: instance.meta,
                    process: instance.type + "_" + instance.meta.name,
                    options: options
                }, function(err, data) {
                    if (err) {
                        if (settings.get("user/deploy/@log") == "error") {
                            tab = openLog(instance);
                            tab.classList.add("error");
                        }
                        return callback(err);
                    }
                    
                    if (data.process) {
                        if (settings.get("user/deploy/@log") == "deploy") {
                            tab = openLog(instance);
                            tab.classList.remove("error");
                            tab.classList.add("loading");
                        }
                    }
                    else {
                        if (data.deployed !== undefined || data.nothing) {
                            if (instance.state == instance.DEPLOYING)
                                instance.state = instance.IDLE;
                            if (data.deployed)
                                instance.update({ lastDeploy: new Date().getTime() });
                            if (tab) tab.classList.remove("loading");
                            callback(err, data);
                        }
                    }
                });
            }
            function cancel(instance, callback) {
                api.cancelDeploy({ 
                    name: instance.type + "_" + instance.meta.name
                }, callback);
            }
            
            function destroy(instance, callback) {
                instance.state = instance.DELETING;
                
                api.destroy({ 
                    name: instance.meta.name 
                }, function(err, success) {
                    if (err || !success)
                        return callback(err, success);
                    
                    instance.unload();
                    callback(null, true);
                });
            }
            
            function getAll(callback) {
                api.getAll({}, callback);
            }

            /***** Helper Functions *****/

            function openLog(instance) {
                var name = instance.meta.name;
                var id = instance.type + "_" + name;
                
                console.show();
                return console.open({
                    name: id, // Forcing only a single tab per id
                    active: true,
                    editorType: "output",
                    document: {
                        title: name + " - Deploy Log",
                        tooltip: name + " - Deploy Log",
                        output: { id : id }
                    }
                }, function(){})
            }

            function auth(instance) {
                deploy.showForm(getAuthForm(), {
                    type: type,
                    kind: "auth",
                    instance: instance
                });
            }
            
            function getAuthForm(){
                if (!authform)
                    authform = plugin.authForm;
                
                authform.draw();
                authform.show();
                
                loginfail = authform.getElement("loginfail");
                loginfail.hide();
                
                return authform;
            }
            
            function getForm(){
                if (!form)
                    form = plugin.createForm;
                
                form.draw();
                form.reset();
                form.show();
                
                return form;
            }
            
            /***** Lifecycle *****/
            
            plugin.on("load", function(){
                load();
            });
            plugin.on("unload", function(){
                deploy.unregister(plugin);
                
                form = authform = null;
                
                loaded = false;
                drawn = false;
            });
            
            /***** Define API *****/
            
            this.__defineGetter__("createMenu", function(){ return menu; });
            
            /**
             * 
             **/
            this.create = wrap("create", create);
            
            /**
             *
             */
            this.rename = wrap("rename", rename);

            /**
             *
             */
            this.update = wrap("update", update);

            /**
             *
             */
            this.destroy = wrap("destroy", destroy);

            /**
             *
             */
            this.deploy = wrap("deploy", deployNow);

            /**
             *
             */
            this.cancel = wrap("cancel", cancel);

            /**
             *
             */
            this.getAll = wrap("getAllApps", getAll);

            /**
             *
             */
            this.login = wrap("login", login);

            /**
             *
             */
            this.logout = wrap("logout", logout);

            /**
             *
             */
             this.draw = draw;

            /**
             *
             */
             this.auth = auth;

            /**
             *
             */
             this.openLog = openLog;
             
             /**
              * 
              */
             this.wrap = wrap;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            DeployTarget: DeployTarget
        })
    }
});
