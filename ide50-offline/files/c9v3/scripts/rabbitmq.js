#!/usr/bin/env node

"use strict";

process.on("SIGINT",function(){
    process.exit(1);
});

var optimist = require("optimist");

var options = optimist
    .usage("Usage: $0")
    .default("settings", "devel")
    .alias("s", "settings")
    .describe("settings", "Settings file to use")
    .boolean("help")
    .describe("help", "Show command line options.");
    
var argv = options.argv;
    
if (argv.help) {
    options.showHelp();
    process.exit();
}

var amqpBin = "amqp-publish";
var settingsName = argv.settings;
var settings = require("./../settings/" + settingsName)();
var format = require("util").format;

var r = settings.rabbitmq;
var url = format("amqp://%s:%s@%s:%s/%s", r.login, r.password, r.host, r.port, r.vhost).replace(/\/*$/, "");

var args = ["--url", url, "-C", "application/json"];
console.log(amqpBin, args.join(" "));
