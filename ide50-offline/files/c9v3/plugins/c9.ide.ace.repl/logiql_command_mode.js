define(function(require, exports, module) {

var oop = require("ace/lib/oop");
var TextMode = require("ace/mode/text").Mode;
var Tokenizer = require("ace/tokenizer").Tokenizer;
var Range = require("ace/range").Range;
var LogiQlMode = new require("ace/mode/logiql").Mode
var FoldMode = require("ace/mode/folding/cstyle").FoldMode;
var CstyleBehaviour = require("ace/mode/behaviour/cstyle").CstyleBehaviour;
var LogiQLReplHighlightRules = require("./logiql_repl_highlight_rules").LogiQLReplHighlightRules

var Mode = function() {
    var highlighter = new LogiQLReplHighlightRules();
    this.$tokenizer = new Tokenizer(highlighter.getRules());
    this.$behaviour = new CstyleBehaviour();
    
    this.$embeds = highlighter.getEmbeds();
    this.createModeDelegates({
        "logiql-": LogiQlMode
    });
    
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.getMatching = LogiQlMode.prototype.getMatching
}).call(Mode.prototype);

exports.Mode = Mode;
});

