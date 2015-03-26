#!/usr/bin/env node

var architect = require("architect");
var optimist = require("optimist");

// Add ability to load AMD modules
require("amd-loader");

if (process.version.match(/^v0/) && parseFloat(process.version.substr(3)) < 10)
    console.warn("You're using Node.js version " + process.version 
        + ". Version 0.10 or higher is recommended. Some features will not work.");

var options = optimist
    .usage("Usage: $0")
    .default("p", process.env.PORT || 8888)
    .describe("p", "Port")
    .default("l", process.env.IP || "0.0.0.0")
    .describe("l", "IP address of the server")
    .boolean("help");
    
var argv = options.argv;
if (argv.help)
    return options.showHelp();

var port = argv.p;
var host = argv.l;

// Get the architect config
var config = require("../configs/update-service")({
    port: port,
    host: host
});

// Create the app
architect.resolveConfig(config, __dirname + "/../plugins", function (err, config) {
    if (err) throw err.message;

    var app = architect.createApp(config, function(err, app) {
        if (err) throw err;
        
        console.log("Update Service Started.");
    });
    app.on("service", function(name, plugin) {
        if (!plugin.name)
            plugin.name = name;
    });
});