#!/usr/bin/env node

"use strict";

process.on("SIGINT",function(){
    process.exit(1);
});

var optimist = require("optimist");
var getDefaultSettings = require("../server.js").getDefaultSettings;

var options = optimist
    .usage("Usage: $0 session|infra")
    .check(function(argv) {
        if (argv._[0] && !(argv._[0] in { "session":1, "infra": 1}))
            throw new Error("Database name must be either 'session' or 'infra'");
    })
    .default("settings", getDefaultSettings())
    .alias("s", "settings")
    .describe("settings", "Settings file to use")
    .describe("read", "use read only redis")
    .boolean("read")
    .default("read", false)
    .boolean("print", false)
    .describe("print", "Print the redis-cli command instead of executing it.")
    .boolean("help")
    .describe("help", "Show command line options.");
    
var argv = options.argv;
    
if (argv.help) {
    options.showHelp();
    process.exit();
}


var redisbin = "redis-cli";
var tool = argv._[0] || "infra";
var settingsName = argv.settings;
var settings = require("./../settings/" + settingsName)();
var redis = argv.read ? settings["redis-slave"] : settings.redis;
var spawn = require("child_process").spawn;

var opt;

switch (tool) {
    case "session":
        opt = settings.sessionredis;
        break;
        
    case "infra":
        opt = redis = argv.read ? settings["redis-slave"] : settings.redis;
        break;
        
    default:
        process.exit(1);
}

var args = ["-h", opt.host, "-p", opt.port, "-a",opt.password];
if (argv.print) {
    console.log(redisbin, args.join(" "));
}
else {
    run(redisbin, args, {}, function(code) {
        process.exit(code);
    });
}

function run(cmd, args, options, callback) {
    options.customFds = [process.stdin.fd, process.stdout.fd, process.stderr.fd];
    var proc = spawn(cmd, args, options);
    
    proc.on('exit', function (code) {
        callback(code);
    });
}