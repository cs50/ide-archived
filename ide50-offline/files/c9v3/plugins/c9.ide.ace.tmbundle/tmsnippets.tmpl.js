define(function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./%languageName%.snippets");
exports.snippets = %snippets%;
exports.scope = "%languageName%";

});
