define(function(require, exports, module) {

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');

var handler = module.exports = Object.create(baseLanguageHandler);
    
handler.handlesLanguage = function(language) {
    return language === "php";
};

handler.getIdentifierRegex = function() {
    // Note: $$ indicates dollars are allowed at the start of variables
    return (/[$$a-zA-Z0-9_\x7f-\xff]/);
};

handler.getCompletionRegex = function() {
    return (/\$/);
};


});
