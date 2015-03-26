define(function(require, exports, module) {

exports.showCli = true;
exports.aceKeyboardHandler = require("ace/keyboard/emacs").handler;

exports.aceKeyboardHandler.addCommand({
    bindKey: "C-x C-f",
    name: "navigate",
    exec: ideCommand
}, {
    bindKey: "C-x C-s",
    name: "save",
    exec: ideCommand
}, {
    bindKey: "C-x s",
    name: "saveall",
    exec: ideCommand
}, {
    bindKey: "C-x C-w",
    name: "saveas",
    exec: ideCommand
});

// todo find a way to integrate ide commands with vim and emacs modes
exports.execIdeCommand = null;
function ideCommand() {
    exports.execIdeCommand(this.name);
}

});