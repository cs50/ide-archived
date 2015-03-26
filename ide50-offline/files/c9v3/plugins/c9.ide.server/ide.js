"use strict";

/**
 * Serves the index.html for the VFS app
 */
main.consumes = [
    "Plugin",
    "db",
    "session",
    "connect.render",
    "connect.render.ejs",
    "connect.static",
    "connect.redirect",
    "c9.static.configs",
    "c9.login"
];
main.provides = ["ide.app"];

module.exports = main;

function main(options, imports, register) {
    var db = imports.db;
    var Plugin = imports.Plugin;
    var session = imports.session;
    var render = imports["connect.render"];
    var getConfig = imports["c9.static.configs"].getConfig;
    var ensureLoggedIn = imports["c9.login"].ensureLoggedIn;
    
    var frontdoor = require("frontdoor");
    var request = require("request");
    var format = require("util").format;
    var error = require("http-error");
    
    /***** Initialization *****/
    
    var plugin = new Plugin("Ajax.org", main.consumes);
    
    var api = frontdoor();
    session.use(api);

    api.use(render.setTemplatePath(__dirname + "/views"));
    
    api.use(function(req, res, next) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        next();
    });
    
    /**
     * the DNS uses this URL to detect if we're up
     */
    api.get("/status", function(params, callback) {
        return callback(null, {"status": "ok"}); 
    });
    
    /**
     * Forward worker requests to the CDN
     */
    api.get("/_worker/:path*", function(req, res, next) {
        var url = options.workerPrefix + req.params.path.replace(/(\.js)*$/, ".js");
        request.get(url, {
            headers: {
                "Accept-Encoding": req.headers["accept-encoding"]
            }
        }).pipe(res);
    });
    
    api.get("/", function(req, res, next) {
        res.redirect(options.ideBaseUrl + "/dashboard.html");
    });
    
    api.get("/:username", {
        params: {
            username: {
                type: /^[0-9a-z_\-]*$/
            }
        }
    }, function(req, res, next) {
        res.redirect(options.ideBaseUrl + "/" + req.params.username);
    });
    
    api.get("/:username/:projectname", {
        params: {
            username: {
                type: /^[0-9a-z_\-]*$/
            },
            projectname: {
                type: "string"
            },
            debug: {
                type: "number",
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
            config: {
                type: "number",
                source: "query",
                optional: true
            },
        }
    }, [
        ensureLoggedIn(),
        function(req, res, next) {
            var username = req.params.username;
            var projectname = req.params.projectname;
            
            db.User.findOne({
                username: username
            }, function(err, owner) {
                if (err) return next(err);
                
                db.Project
                    .findOne({
                        owner: owner,
                        name: projectname
                    })
                    .populate("owner")
                    .exec(function(err, project) {
                        if (err && err.code == 404 && err.className == "Project")
                            return next(new error.NotFound(format('Project "%s/%s" does not exist.', username, projectname)));
                            
                        if (err) 
                            return next(err);
        
                        if (
                            project.lost_gear || 
                            !project.remote || 
                            project.state == db.Project.STATE_MIGRATING ||
                            project.scm == "ftp" ||
                            project.scm == "openshift"
                        ) {
                            var oldClient = options.ideBaseUrl + "/" + username + "/" + projectname + "?nc=1";
                            return res.redirect(oldClient);
                        }

                        getConfig(project, req.user, req.params, function(err, architectConfig) {
                            if (err) return next(err);
                            var configName = architectConfig.filter(function(c) {
                                return c.packagePath && c.packagePath.match(/\/c9\.core\/c9$/);
                            })[0].configName;
                            
                            
                            var data = {
                                architectConfig: architectConfig,
                                configName: configName,
                                name: project.name,
                                pid: project.id,
                                ideBaseUrl: options.ideBaseUrl,
                                appId: options.appId + "_postmessage" || "ide_postmessage",
                                packed: options.packed,
                                packedThemes: options.packedThemes,
                                debug: req.params.debug == 1,
                            };
                            
                            res.setHeader("Cache-Control", "no-cache, no-store");
                            if (req.params.config === 1) {
                                res.json(data);
                            } else {
                                res.render("ide.html.ejs", data, next);
                            }
                        });
                    });
                });
        }
    ]);
    
    /***** Register and define API *****/
    
    plugin.freezePublicAPI({});
    
    register(null, {
        "ide.app": plugin
    });
}