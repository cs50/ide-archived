#!/usr/bin/env node
"use strict";

require("amd-loader");
var optimist = require("optimist");
var path = require("path");
var build = require("architect-build/build");

var options = optimist(process.argv)
    .usage("Usage: $0 [--help]")
    .alias("c", "config")
    .default("config", __dirname + "/../configs/client-default.js")
    .describe("config", "Config file to use as input")
    
    .alias("i", "input")
    .default("input", __dirname + "/../build/static")
    .describe("input", "input directory")
    
    .alias("d", "dest")
    .default("dest", "compiled.js")
    .describe("dest", "destination file")
    
    .boolean("help")
    .describe("help", "Show command line options.");
    
var argv = options.argv;

if (argv.help) {
    options.showHelp();
    process.exit();
}

main(argv.config, argv.input, argv.dest, function(err) {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    process.exit(0);
});

function main(config, inputDirectory, dest, callback) {
    if (config[0] !== "/")
        config = path.join(__dirname, "/../configs/", config);
   
   var root = path.resolve(inputDirectory);
   
    var settings = require("../settings/standalone");
    
    var plugins = require(config)(settings(), options)
        .concat([
            "lib/architect/architect",
            "ace/mode/html",
            "ace/mode/javascript",
            "ace/mode/css",
            "ace/mode/c9search",
            "ace/theme/textmate",
            "ace/theme/tomorrow_night_bright",
            "ace/theme/idle_fingers"
        ]);
    
    var rjs = require(path.join(root, "/static/requirejs-config.json"));
    
    build(plugins, {
        pathConfig: pathConfig(rjs, root),
        enableBrowser: true,
        includeConfig: false,
        noArchitect: true,
        compress: false,
        filter: [],
        ignore: {"amdefine": true},
        withRequire: true,
        basepath: root,
        outputFolder: path.dirname(dest),
        outputFile: path.basename(dest)
    }, callback);
}

function pathConfig(rjs, root) {
    rjs.root = path.join(root, rjs.baseUrl);
    for (var p in rjs.paths) {
        rjs.paths[p] = path.join(root, rjs.paths[p]);
    }
    return rjs;
}

