define(function(require, exports, module) {
    main.consumes = [
        "performancestats", "c9.analytics"
    ];
    main.provides = ["performancestats_analytics"];
    module.exports = main;
    
    return main;

    function main(options, imports, register) {
        var analytics = imports["c9.analytics"];
        var performancestats = imports.performancestats;
        
        // Always track in DWH
        var analyticsOptions = {
            integrations: {
                "All": true
            }
        };
        
        var eventName = "Stats Plugin Action Triggered";
        performancestats.on("resourceLimitHit", function(e) {
            analytics.track(eventName, {
                type: "resourceLimitHit",
                resourceType: e.type
            }, analyticsOptions);
        });
        
        performancestats.on("resizeStart", function(e) {
            analytics.track(eventName, {
                type: "resizeStart",
                source: e.source,
                machine: e.machine
            }, analyticsOptions);
        });
        
        performancestats.on("resizeEnd", function(e) {
            analytics.track(eventName, {
                type: "resizeEnd",
                source: e.source,
                machine: e.machine
            }, analyticsOptions);
        });
        
        performancestats.on("restartStart", function(e) {
            analytics.track(eventName, {
                type: "restartStart",
                source: e.source
            }, analyticsOptions);
        });
        
        performancestats.on("restartEnd", function(e) {
            analytics.track(eventName, {
                type: "restartEnd",
                source: e.source
            }, analyticsOptions);
        });
        
        performancestats.on("processListShow", function(e) {
            console.log("processListShow")
            analytics.track(eventName, {
                type: "processListShow",
                source: e.source
            }, analyticsOptions);
        });
        
        performancestats.on("confirmAccountRedirect", function(e) {
            analytics.track(eventName, {
                type: "confirmAccountRedirect",
                source: e.source
            }, analyticsOptions);
        });
        
        register(null, {
            "performancestats_analytics": {}
        });
    }
});
