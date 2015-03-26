"use server";

require("amd-loader");
var fs = require("fs");
var ctags = require("./ctags.js");

function parseFile(filenameWithPath) {
    var content = fs.readFileSync(filenameWithPath);
    
    var lastSlashPos = filenameWithPath.lastIndexOf("/");
    var path = filenameWithPath.substr(0, lastSlashPos);
    var filename = filenameWithPath.substr(lastSlashPos + 1, filenameWithPath.length - lastSlashPos - 1);
    
    ctags.FS_createPath("/", path, true, true);
    ctags.FS_createDataFile("/" + path, filename, content, true, false);
    ctags.CTags_parseFile("/" + filenameWithPath);
}

function onTagEntry(name, kind, lineNumber, sourceFile, language) {
    console.log(name + " " + kind + " " + lineNumber + " " + sourceFile + " " + language);
}

function onParseFileComplete(sourceFile) {
    console.log("Done: " + sourceFile);
}

var lang = ctags.CTags_getLanguage("ctags_test.js");
console.log("Language detected: " + lang);

ctags.CTags_setOnTagEntry(onTagEntry);
ctags.CTags_setOnParsingCompleted(onParseFileComplete);

parseFile(__dirname + "/ctags_test.js");