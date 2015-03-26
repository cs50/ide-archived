/* global Treasure */

define(function(require, exports, module) {
    "use strict";
    
    var assert = require("assert");
    var _ = require("lodash");
    var TreasureData = require("./provider/treasuredata-1.1.1");

    /**
     * Analytics plugin
     */
    main.consumes = ["Plugin", "info"];
    main.provides = ["c9.analytics"];

    module.exports = main;
    
    function main(options, imports, register) {
        
        assert(typeof options.secret, "object", "Option 'secret' is required");
        assert(typeof options.flushAt, "object", "Option 'flushAt' is required");
        assert(typeof options.integrations, "object", "Option 'integrations' is required");
        assert(typeof options.tdWriteKey, "object", "Option 'tdWriteKey' is required");
        assert(typeof options.tdDb, "object", "Option 'tdDb' is required");
        
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var info = imports.info;
        
        var INTEGRATIONS = options.integrations;
        var user, workspace;
    
        function load() {
            user = info.getUser();
            workspace = info.getWorkspace();
        }
        
        window.analytics=window.analytics||[],window.analytics.methods=["identify","group","track","page","pageview","alias","ready","on","once","off","trackLink","trackForm","trackClick","trackSubmit"],window.analytics.factory=function(t){return function(){var a=Array.prototype.slice.call(arguments);return a.unshift(t),window.analytics.push(a),window.analytics}};for(var i=0;i<window.analytics.methods.length;i++){var key=window.analytics.methods[i];window.analytics[key]=window.analytics.factory(key)}window.analytics.load=function(t){if(!document.getElementById("analytics-js")){var a=document.createElement("script");a.type="text/javascript",a.id="analytics-js",a.async=!0,a.src=("https:"===document.location.protocol?"https://":"http://")+"cdn.segment.io/analytics.js/v1/"+t+"/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(a,n)}},window.analytics.SNIPPET_VERSION="2.0.9",
        window.analytics.load(options.secret, {
            flushAt: options.flushAt
        });

        // load TreasureData DWH analytics
        var td = new Treasure({
            writeKey: options.tdWriteKey,
            database: options.tdDb
        });

        // track all identify stats sent to Segment.io in the DWH (user_logs table) as well
        window.analytics.on('identify', function(userId, properties, options) {
            if (sendToDwh(options)) {
                properties.event = "Identify";
                properties.uid = userId;
                td.trackEvent("user_logs", properties);
            }
        });    
        // track all alias stats sent to Segment.io in the DWH (alias_logs table) as well
        window.analytics.on('alias', function(userId, previousId, options) {
            if (sendToDwh(options)) {
                td.trackEvent("alias_logs", {
                    event: "Alias",
                    uid: userId,
                    previousId: previousId
                });
            }
        });    
        // track all pageview stats sent to Segment.io in the DWH (pageviews table) as well
        window.analytics.on('page', function(event, properties, options) {
            if (sendToDwh(options)) {
                td.trackPageview('pageviews');
            }
        });    
        // track all event stats sent to Segment.io in the DWH (event_logs table) as well
        window.analytics.on('track', function(event, properties, options) {
            if (sendToDwh(options)) {
                properties.event = event;
                properties.uid = user.id;
                properties.username = user.name;
                properties.workspaceId = workspace.id;
                var tdTable = options.tdTable ? options.tdTable : "event_logs";
                td.trackEvent(tdTable, properties);
            }
        });
        
        // track pages
        window.analytics.page();
        
        /**
         * Whether to send stats to the DWH
         * @param {Object} options The options specified
         * @return {Boolean} true if should be sent to DWH
         */
        function sendToDwh(options) {
            var noIntegrations = options && !options.integrations;
            var dwhSpecified = options && options.integrations && (
                (options.integrations["DWH"]) ||
                (options.integrations["All"] && 
                options.integrations["DWH"] !== false)
            );
            if (noIntegrations || dwhSpecified) 
                return true;
            else
                return false;
        }
        
        /**
         * Track an event in the Analytics solution
         * @param {String} event The event to track
         * @param {Object} properties Properties (parameters) of the event
         * @param {Object} options Options like whether it should go to the DWH
         */
        function track(event, properties, options) {
            if (!options)
                options = { integrations: INTEGRATIONS };
            if (!options.integrations)
                options.integrations = {};
            options.integrations = _.extend({}, INTEGRATIONS, options.integrations);
            properties = properties ? properties : {};
            // only send to Segment.io if there are more integrations than DWH and All
            var integrationsWithoutDWH = Object.keys(options.integrations).filter(
                function(el) {
                return el != "DWH" && el != "All";
            });
            if (options.integrations["All"] || 
                integrationsWithoutDWH.length > 0) {
                window.analytics.track(event, properties, _.clone(options, true));
            }
            else if (options.integrations["DWH"]) {
                properties.event = event;
                properties.uid = user.id;
                properties.username = user.name;
                properties.workspaceId = workspace.id;
                var tdTable = options.tdTable ? options.tdTable : "event_logs";
                td.trackEvent(tdTable, properties);
            }
        }
        
        /***** Register and define API *****/

        plugin.on("load", load);
        
        plugin.freezePublicAPI({
            track: track,
            identify: window.analytics.identify.bind(window.analytics),
            alias: window.analytics.alias.bind(window.analytics)
        });
        
        register(null, {
            "c9.analytics": plugin
        });
    }
});