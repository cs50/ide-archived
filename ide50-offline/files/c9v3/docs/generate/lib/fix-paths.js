var modules = require("module");
var oldResolve = modules._resolveFilename;
var extraPaths = [
    __dirname + "/../../../node_modules/ace/lib",
    __dirname + "/../../../node_modules/treehugger/lib",
];
modules._resolveFilename = function(request, paths) {
    extraPaths.forEach(function(p) {
        if(paths.paths.indexOf(p) === -1)
            paths.paths.push(p);
    });
    return oldResolve(request, paths);
};
