/**
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {

var completeUtil = require("plugins/c9.ide.language/complete_util");
var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');

var completer = module.exports = Object.create(baseLanguageHandler);

var snippetCache = {}; // extension -> snippets
    
completer.handlesLanguage = function(language) {
    return snippetCache[language] || snippetCache._;
};

completer.getMaxFileSizeSupported = function() {
    return Infinity;
};

completer.complete = function(doc, fullAst, pos, currentNode, callback) {
    var line = doc.getLine(pos.row);
    var identifier = completeUtil.retrievePrecedingIdentifier(line, pos.column, completer.$getIdentifierRegex());
    if (line[pos.column - identifier.length - 1] === '.') // No snippet completion after "."
        return callback([]);

    var snippets = snippetCache[this.language];
    
    var allIdentifiers = Object.keys(snippets);
    
    var matches = completeUtil.findCompletions(identifier, allIdentifiers);
    callback(matches.map(function(m) {
        var snippet = snippets[m];
        return {
            name: snippet.name,
            snippet: snippet.content,
            replaceText: snippet.name,
            doc: "<pre>" + snippet.content + "</pre>",
            icon: "package",
            meta: "snippet",
            priority: 0 // todo change this back to 2 once snippets are cleaned up
        };
    }));
};

completer.init = function(callback) {
    this.sender.on("loadSnippets", function(e) {
        snippetCache[e.data.language] = e.data.snippets;
    });
    callback();
};

});
