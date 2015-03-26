define(function(require, exports, module) {

exports.showCli = true;
var Vim = require("ace/keyboard/vim").Vim;
exports.aceKeyboardHandler = require("ace/keyboard/vim").handler;

exports.aceKeyboardHandler.defaultKeymap.unshift(
    { keys: ':', type: 'action', action: 'aceCommand', actionArgs: { exec: function(ace) {
        ace.showCommandLine(":");
    } } }
);

exports.aceKeyboardHandler.defaultKeymap.push(
    {keys: 'gt', type: 'action', action: 'aceCommand', actionArgs: {exec: ideCommand, name: 'gototableft'}},
    {keys: 'gT', type: 'action', action: 'aceCommand', actionArgs: {exec: ideCommand, name: 'gototabright'}}
);

exports.execIdeCommand = null;
function ideCommand() {
    exports.execIdeCommand(this.name);
}
/**
 *  require(["plugins/c9.ide.ace.keymaps/vim/keymap"], function(vim) {
 *      vim.map("J", "8j", "normal")
 *      vim.map("K", "8k", "normal")
 *      vim.map(",b", "c9:build", "normal")
 *      vim.map(",g", "c9:run", "normal")
 *  });
 */
exports.map = function(keys, action, context) {
    if (!action)
        return Vim.unmap(keys, context);
    var mapping;
    if (typeof action == "function") {
        mapping = {
            keys: keys,
            type: 'action',
            action: 'aceCommand',
            actionArgs: { exec: ideCommand, name: 'gototableft' }
        };
    }
    if (/^c9:/.test(action)) {
        var commandName = action.substr(3);
        
        mapping = {
            keys: keys,
            type: 'action',
            action: 'aceCommand',
            actionArgs: { exec: ideCommand, name: commandName }
        };
    }
    if (mapping) {
        if (context)
            mapping.context = context;
        mapping.user = true;
        exports.aceKeyboardHandler.defaultKeymap.unshift(mapping);
    } else {
        Vim.map(keys, action, context);
    }
};


});