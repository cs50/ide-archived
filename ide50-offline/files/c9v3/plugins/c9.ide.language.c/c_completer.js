/**
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {

var completeUtil = require("plugins/c9.ide.language/complete_util");
var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
var cLibs = require("./clibs");
console.log(cLibs);

var completer = module.exports = Object.create(baseLanguageHandler);

completer.handlesLanguage = function(language) {
    return language === "c_cpp";
};

completer.complete = function(doc, fullAst, pos, currentNode, callback) {
    var line = doc.getLine(pos.row);
    var prefix = line.substring(0, pos.column);
    console.log(prefix);
    var identifier = completeUtil.retrievePrecedingIdentifier(line, pos.column);
    var allIdentifiers = Object.keys(cLibs);
    var matches = completeUtil.findCompletions(identifier, allIdentifiers);
    callback(matches.map(function(m) {
        return {
          docHead: cLibs[m]["fullname"],
          name: cLibs[m]["name"],
          replaceText: cLibs[m]["code"],
          type: "function",
          doc: "<pre>" + cLibs[m]["purpose"].replace("\^\^", "&#9251;").replace(/</g, "&lt;") + "</pre>",
          docUrl: "http://reference.cs50.net/"+cLibs[m]["lib"]+"/"+m,
          icon: null,
          isFunction: true,
          meta: cLibs[m]["lib"],
          priority: 2
        };
    }));
};


});
