/**
 * jsonalyzer php analysis
 *
 * @copyright 2014, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");

var handler = module.exports = Object.create(PluginBase);

handler.extensions = ["php", "php3", "php4", "php5"];

handler.languages = ["php"];

handler.maxCallInterval = handler.CALL_INTERVAL_BASIC;

handler.init = function(options, callback) {
    callback();
};

handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    this.$lint(
        "php",
        doc ? ["-l"]: ["-l", path],
        doc,
        function(err, stdout, stderr) {
            if (err) return callback(err);
            
            var markers = [];
            
            (stdout + stderr).split("\n").forEach(function(line) {
                var match = line.match(/(?:Parse error: )(.*?) in (?:.*?) on line (\d+)/);
                if (!match)
                    return;
                var message = match[1];
                var row = match[2];
                markers.push({
                    pos: { sl: parseInt(row, 10) - 1 },
                    message: message,
                    level: message.match(/error/) ? "error": "warning"
                });
            });
            
            callback(null, null, markers);
        }
    );
};

});