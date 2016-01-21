"use strict";

module.exports = function(options) {
    // Remove runners we don't want
    delete options.runners["C (simple)"];
    delete options.runners["PHP (cli)"];
    delete options.runners["PHP (built-in web server)"];
    delete options.runners["Apache httpd (PHP, HTML)"];

    options.projectName = "ide50-offline";

    var config = require("./client-default")(options);

    var includes = [
        "plugins/c9.ide.cs50.simple/simple50",
        "plugins/c9.ide.cs50.info/info50",
        "plugins/c9.ide.cs50.previewer/previewer50",
        {
            packagePath: "plugins/c9.ide.cs50.themes/themes50",
            staticPrefix: options.staticPrefix + "/plugins/c9.ide.cs50.themes"
        }
    ];

    var excludes = {
        "plugins/c9.ide.login/login": true,
        "plugins/c9.ide.welcome/welcome": true
    };

    config = config.concat(includes).map(function(p) {
        if (typeof p == "string")
            p = { packagePath: p };
        return p;
    }).filter(function (p) {
        if (p.packagePath == "plugins/c9.ide.layout.classic/preload") {
            p.defaultTheme = "flat-light"; // set flat theme as default
        }
        else if (p.packagePath == "plugins/c9.fs/fs.cache.xml") {
            p.rootLabel = "~/workspace";
        }
        return !excludes[p.packagePath];
    });
    
    return config;
};
