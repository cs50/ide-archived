/**
 * Serve client configs
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin",
        "connect",
        "api",
        "db"
    ];
    main.provides = ["c9.static.configs"];
    return main;


    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var connect = imports.connect;
        var api = imports.api;
        var db = imports.db;

        var fs = require("fs");
        var path = require("path");
        var error = require("http-error");
        var async = require("async");
        var runners = require("../c9.ide.run/runners_list");
        var builders = require("../c9.ide.run.build/builders_list");
        var vfsExtendToken = require("../c9.vfs.server/vfs_extend_token");

        /***** Initialization *****/
        
        var HOSTED_WORKSPACES = {
            openshift: true,
            docker: true
        };
        var plugin = new Plugin("Ajax.org", main.consumes);

        var section = api.section("config");

        section.get("/require_config.js", {}, function(req, res, next) {
            var config = res.getOptions().requirejsConfig || {};
            config.waitSeconds = 60;
            
            res.writeHead(200, {"Content-Type": "text/javascript"});
            res.end("requirejs.config(" + JSON.stringify(config) + ");");
        });
        
        section.get("/:pid", {
            params: {
                pid: {
                    type: /^[0-9]+(:?\.(:?js|json))?$/,
                    source: "url"
                },
                callback: {
                    type: "string",
                    source: "query",
                    optional: true
                },
                collab: {
                    type: "number",
                    source: "query",
                    optional: true
                },
                nocollab: {
                    type: "number",
                    optional: true,
                    source: "query"
                },
            }
        }, [
            api.authenticate(),
            function(req, res, next) {
                var params = req.params;
                var ext = params.pid.split(".")[1] || "json";
                var pid = params.pid.split(".")[0];
                var type = ext == "js" || params.callback
                    ? "text/javascript"
                    : "application/json";

                var user = req.user;
                getConfigForProject(pid, user, params, function(err, architectConfig) {
                    if (err) return next(err);
                    
                    res.writeHead(200, {"Content-Type": type});
                    
                    if (ext == "js")
                        res.end("require.plugins = " + JSON.stringify(architectConfig));
                    else if (params.callback)
                        res.end(params.callback + "(" + JSON.stringify(architectConfig) + ");");
                    else 
                        res.end(JSON.stringify(architectConfig));
                });
            }
        ]);
        
        function getConfigForProject(pid, user, params, callback) {
            db.Project
                .findOne({project: pid})
                .populate("owner")
                .populate("remote")
                .exec(function(err, project) {
                    if (err) return callback(err);

                    if ((!(project.remote.type in HOSTED_WORKSPACES)) && project.remote.type != "ssh")
                        return callback(new error.BadRequest("Only non 'ftp' projects are currently supported by the new client."));
                        
                    db.WorkspaceMember.findOne({project: project, user: user}, function(err, member) {
                        if (err) return callback(err);

                        var role = member ? member.role : db.Project.ROLE_VISITOR;
                        // ide server should allow non-member loading of private projects - to request access
                        // if (role == db.Project.ROLE_VISITOR && project.isPrivate())
                        //     role = db.Project.ROLE_NONE;

                        var workspaceId = project.owner.name + "/" + project.name;
                        var readonly;
                        var isAdmin = project.owner.id == user.id;

                        switch(role) {
                            case db.Project.ROLE_NONE:
                                return callback(new error.Forbidden("User '"+ user.name +"' is not allowed to access workspace '" + workspaceId + "'"));
                                
                            case db.Project.ROLE_VISITOR:
                                readonly = true;
                                break;
                                
                            case db.Project.ROLE_COLLABORATOR:
                                readonly = member.acl !== "rw";
                                break;

                            case db.Project.ROLE_ADMIN:
                                readonly = false;
                                break;
                        }
                        
                        var configPath, clientOptions, clientSettings, architectConfig;
                        async.series([
                            function (next) {
                                getClientConfig(project, readonly, function(err, path) {
                                    configPath = path;
                                    next(err);
                                });
                            },
                            function (next) {
                                getClientOptions(project, configPath, function(err, options) {
                                    if (err) return next(err);
    
                                    clientOptions = options;
                                    next();
                                });
                            },
                            function (next) {
                                var projectSettings, userSettings, stateSettings;
                                async.series([
                                    function(next){
                                        async.parallel([
                                            function (next) {
                                                project.getSettings(function (err, settings) {
                                                    projectSettings = settings;
                                                    next(err);
                                                });
                                            },
                                            function (next) {
                                                user.getSettings(function (err, settings) {
                                                    userSettings = settings;
                                                    next(err);
                                                });
                                            }
                                        ], next);
                                    },
                                    function (next) {
                                        var useOwnerSettings;
                                        try { useOwnerSettings = JSON.parse(projectSettings).share["@useOwnerSettings"] }
                                        catch(e) { useOwnerSettings = false; }
                                        
                                        function getOwnerSettings(){
                                            db.WorkspaceMember.findOne({
                                                project: project, 
                                                user: project.owner
                                            }, function(err, owner) {
                                                if (err) return next(err);
                                                
                                                owner.getSettings(project, function (err, settings) {
                                                    stateSettings = settings;
                                                    next(err);
                                                });
                                            });
                                        }
                                        
                                        if (useOwnerSettings) {
                                            getOwnerSettings();
                                        }
                                        else {
                                            if (!member)
                                                return next();
                                            member.getSettings(project, function (err, settings) {
                                                if (!settings)
                                                    return getOwnerSettings();
                                                
                                                stateSettings = settings;
                                                next(err);
                                            });
                                        }
                                    }
                                ], function (err) {
                                    if (err)
                                        return next(err);
                                        
                                    clientSettings = {
                                        user: userSettings ||  {},
                                        project: projectSettings || {},
                                        state: stateSettings || {}
                                    };
                                    next();
                                });
                            },
                            function (next) {
                                var enableCollabForProject =
                                    (project.remote.type in HOSTED_WORKSPACES || project.remote.type === "ssh");
                                clientOptions.user = user;
                                clientOptions.project = project;
                                clientOptions.readonly = readonly;
                                clientOptions.role = role;
                                clientOptions.isAdmin = isAdmin;
                                clientOptions.settings = clientSettings;
                                clientOptions.collab = options.options.collab && enableCollabForProject && params.collab != 0 && params.nocollab != 1;
                                clientOptions.extendToken = vfsExtendToken(project.id, user.id);
                                try {
                                    architectConfig = require(configPath)(clientOptions);
                                }
                                catch (e) {
                                    return next(e);
                                }
                                next();
                            }
                        ], function (err) {
                            callback(err, architectConfig);
                        });
                    });
                });
        }
        
        function getClientConfig(project, readonly, callback) {
            var path = __dirname + "/../../configs/client-" + 
                project.getClientConfigName() + (readonly ? "-ro.js" : ".js");
            
            fs.exists(path, function(exists) {
                if (!exists && readonly) {
                    path = __dirname + "/../../configs/client-default-ro.js";
                    fs.exists(path, done);
                    return;
                }
                done(exists);
            });
            
            function done(exists) {
                if (!exists)
                    return callback(new error.NotFound("Client config '" + path + "' not found"));
                
                callback(null, path);  
            }
        }
        
        function getClientOptions(project, configPath, callback) {
            project.remote.getClientOptions(function(err, remoteOptions) {
                if (err) return callback(err);
                
                db.Vfs.findAllAndPurge(20 * 1000, function(err, servers) {
                    if (err) return callback(err);

                    var clientOptions = {};
                    
                    for (var key in options.options) {
                        clientOptions[key] = options.options[key];
                    }
                    
                    for (var key in remoteOptions)
                        clientOptions[key] = remoteOptions[key];
                        
                    clientOptions.vfsServers = servers;
                    clientOptions.projectId = project.id;
                    clientOptions.workspaceId = project.owner.name + "/" + project.name;
                    clientOptions.workspaceName = project.name;
                    clientOptions.projectName = project.name;

                    clientOptions.runners = runners[project.remote.type];
                    clientOptions.builders = builders;
                    clientOptions.previewBaseUrl = options.previewBaseUrl;
                    clientOptions.previewUrl = options.previewBaseUrl + "/" + clientOptions.workspaceId;

                    clientOptions.local = false;
                    
                    clientOptions.staticPrefix = connect.getGlobalOption("staticPrefix");
                    clientOptions.workerPrefix = connect.getGlobalOption("workerPrefix");
                    
                    var configName = path.basename(configPath, ".js").replace(/^client-/, "");
                    clientOptions.configName = configName;
                    clientOptions.themePrefix = clientOptions.themePrefix + "/" + configName;
                    clientOptions.CORSWorkerPrefix = clientOptions.packed
                        ? clientOptions.staticPrefix + "/../worker/"
                        : null; // use unpacked worker
                    clientOptions.installPath = "~/.c9";
                    clientOptions.correctedInstallPath = "~/.c9";
                    
                    callback(null, clientOptions);
                });
            });
        }
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            getConfig: getConfigForProject
        });
        
        register(null, {
            "c9.static.configs": plugin
        });
    }
});