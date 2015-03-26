define(function(require, exports, module) {
    "use strict";

    /**
     * User Activity plugin
     */
     
    main.consumes = ["c9.analytics", "c9", "Plugin", "c9.analytics.cookie", "info"];
    main.provides = ["c9.analytics.user_activity"];
    
    module.exports = main;
    
    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var cookie = imports["c9.analytics.cookie"];
        var analytics = imports["c9.analytics"];
        var info = imports.info;
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var COOKIE_TIMESTAMP_NAME = "c9_ide_timestamp";
        var user, workspace;
        
        
        function load() {
            user = info.getUser();
            workspace = info.getWorkspace();
            setupActivityLogging();
        }
        
        function setupActivityLogging() {
            if (c9.connected) {
                logUserActivity();
                logWorkspaceActivity();
            }
    
            window.addEventListener("focus", function() {
                logUserActivity();
                logWorkspaceActivity();
            });
            
            window.addEventListener("blur", function() {
                logUserActivity();
                logWorkspaceActivity();
            });
    
            c9.on("connect", function() {
                logUserActivity();
                logWorkspaceActivity();
            });
            
            c9.on("disconnect", function() {
                logUserActivity();
                logWorkspaceActivity();
            });
        }
        
        function logUserActivity() {
            var lastView = cookie.get(COOKIE_TIMESTAMP_NAME);
            if (lastView === "" || new Date(+lastView).getDate() != new Date().getDate()) {
                analytics.track("IDE became active");
                cookie.set(COOKIE_TIMESTAMP_NAME, Date.now(), 1);
                
                // also Identify in case they don't login - if we don't do this, 
                // some people won't be marked as "Last seen" in Mixpanel and
                // might get useless emails
                var firstName = user.fullname.split(' ').slice(0, 1).join(' ');
                var lastName = user.fullname.split(' ').slice(1).join(' ');
                var traits = {
                    uid: user.id,
                    username: user.name,
                    email: user.email,
                    createdAt: Number(user.date_add),
                    active: (user.active === "1"), // stored as a String value in our db for some reason
                    alpha: user.alpha,
                    beta: user.beta,
                    c9version: user.c9version,
                    firstName: firstName,
                    lastName: lastName,
                    name: user.fullname,
                    no_newsletter: user.no_newsletter,
                    subscription_on_signup: user.subscription_on_signup,
                    pricingPlan: user.premium ? "Premium" : "Free",
                    region: user.region
                };
                analytics.identify(String(user.id), traits);
            }
        }
        
        function logWorkspaceActivity() {
            var cookieName = COOKIE_TIMESTAMP_NAME + '-' + workspace.id;
            var lastView = cookie.get(cookieName);
            if (lastView === "" || new Date(+lastView).getDate() != new Date().getDate()) {
                analytics.track("Workspace became active", {
                    workspaceId: workspace.id,
                    workspaceType: workspace.contents,
                    name: workspace.name
                });
                cookie.set(cookieName, Date.now(), 1);
            }
        }

        /***** Register and define API *****/
        
        plugin.on("load", load);
        
        register(null, {
            "c9.analytics.user_activity": plugin
        });
    }
});
