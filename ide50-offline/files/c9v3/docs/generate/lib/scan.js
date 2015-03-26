#!/usr/bin/env node

require("amd-loader");
require("./fix-paths");

var fs    = require("fs");
var path  = require("path");
var parse = require("./parse");
var files;

var data  = "";
var stdin = process.openStdin();
stdin.on('data', function(chunk) { 
    data += chunk;
});
stdin.on('end', function(chunk) { 
    files = data.split("\n");
    
    console.log("Starting Cloud9 Documentation Pre-processor");
    next();
});

function next(){
    if (!files.length) {
        console.log("Done.");
        process.exit(0);
        return;
    }
        
    var file = files.pop();
    if (!file) return next();
    
    console.log("Processing " + file.replace(/^(?:\.\.\/){2}plugins\//, ""));
    
    fs.readFile(file, function(err, data){
        if (err) throw err;
        
        var parsed = parse(data);
        if (!parsed.firstComment && !parsed.name) 
            return next();
        
        if (!parsed.name) {
            parsed.name = path.basename(file).split(".")[0];
            parsed.result = parsed.firstComment;
        }
        
        fs.writeFile("output/parsed/" + parsed.name + ".js", 
          parsed.result, function(err){
            if (err) throw err;
            
            next();
        });
    });
}