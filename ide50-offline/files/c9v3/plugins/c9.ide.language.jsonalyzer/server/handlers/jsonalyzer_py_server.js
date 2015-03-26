/**
 * jsonalyzer python analysis
 *
 * @copyright 2014, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var fs = require("fs");
var crypto = require("crypto");
var pathSep = require("path").sep;

var handler = module.exports = Object.create(PluginBase);

var OPTIONS = [
    "-d", "all",
    "-e", "E", 
    "-e", "F", 
    "-e", "W0101", // Unreachable code
    "-e", "W0109", // Duplicate key in dictionary
    "-e", "W0199", // Assert called on a 2-tuple. Did you mean \'assert x,y\'?
    "-e", "W0612", // Unused variable
    "-e", "W0602", // Used global without assignment
    "-r", "n", 
    "--msg-template={line}:{column}: [{msg_id}] {msg}"
];

var TEMPDIR = process.env.TMP || process.env.TMPDIR || process.env.TEMP || '/tmp';

handler.extensions = ["py"];

handler.languages = ["py"];

handler.maxCallInterval = handler.CALL_INTERVAL_BASIC;

handler.init = function(options, callback) {
    callback();
};

handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    if (!doc)
        return this.$exec(path, doc, callback);
    
    var tempFile = getTempFile() + ".py";
    var that = this;
    fs.writeFile(tempFile, doc, "utf8", function(err) {
        if (err) {
            err.code = "EFATAL";
            return callback(err);
        }
        that.$exec(tempFile, doc, function(err, summary, markers) {
            fs.unlink(tempFile, function() {
                if (err) console.error(err);
                callback(err, summary, markers);
            });
        });
    });
};

function getTempFile() {
    return TEMPDIR + pathSep + "c9_pyl_" + crypto
        .randomBytes(6)
        .toString("base64")
        .slice(0, 6)
        .replace(/[+\/]+/g, "");
}

handler.$exec = function(path, doc, callback) {
    var starImport = /from\s+[^\s]+\s+import\s+\*/.test(doc);
    this.$lint(
        "pylint",
        OPTIONS.concat(path),
        function(err, stdout, stderr) {
            if (err) return callback(err);

            var markers = [];
            
            stdout.split("\n").forEach(function(line) {
                var match = line.match(/(\d+):(\d+): \[([^\]]+)\] (.*)/);
                if (!match)
                    return;
                var row = match[1];
                var column = match[2];
                var code = match[3];
                var message = match[4];
                var level = getLevel(code);
                
                if (/print statement used/.test(message))
                    return;
                if (starImport && /undefined variable/i.test(message)) {
                    level = "info";
                    message += "?";
                }
                    
                markers.push({
                    pos: {
                        sl: parseInt(row, 10) - 1,
                        sc: parseInt(column, 10)
                    },
                    message: message,
                    code: code,
                    level: level
                });
            });
            
            callback(null, null, markers);
        }
    );
}

function getLevel(code) {
    if (code[0] === "E" || code[0] === "F")
        return "error";
    if (code === "W0612") // unused variable
        return "info";
    if (code === "W0602") // global without assignment
        return "info";
    return "warning";
}

});