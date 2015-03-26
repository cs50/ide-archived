/**
 * Ajax.org Code Editor (ACE)
 *
 * @copyright 2010, Ajax.org Services B.V.
 * @license LGPLv3 <http://www.gnu.org/licenses/lgpl-3.0.txt>
 * @author Fabian Jakobs <fabian AT ajax DOT org>
 */
define(function(require, exports, module) {
"use strict";

var Util = require("./util");
var EventEmitter = Util.EventEmitter;

var WSV8DebuggerService = module.exports = function(socket) {
    this.$socket = socket;
    this.$state = "initialized";
    this.$onAttach = [];
};

(function() {

    Util.implement(this, EventEmitter);

    this.attach = function(tabId, callback) {
        if (this.$state == "connected")
            return callback(new Error("already attached!"));

        this.$onAttach.push(callback);
        if (this.$state == "initialized") {
            this.$socket.send(JSON.stringify({command: "DebugAttachNode", runner: "node"}));
            this.$onMessageHandler = this.$onMessage.bind(this);
            this.$socket.on("message", this.$onMessageHandler);
            this.$state = "connecting";
        }
    };

    this.$onMessage = function(data) {
        var message;
        //console.log("INCOMING: ", data);
        try {
            message = JSON.parse(data);
        }
        catch (ex) {
            return;
        }
        if (message.type == "node-debug-ready") {
            this.pid = message.pid;
            this.$state = "connected";
            for (var i = 0, l = this.$onAttach.length; i < l; i++)
                this.$onAttach[i]();
            this.$onAttach = [];
        }
        else if (message.type == "node-debug") {
            this.emit("debugger_command_0", {data: message.body});
        }
    };

    this.detach = function(tabId, callback) {
        this.$state = "initialized";
        this.$socket.removeListener("message", this.$onMessageHandler);
        callback();
    };

    this.debuggerCommand = function(tabId, v8Command) {
        this.$socket.send(JSON.stringify({
            command: "debugNode",
            pid: this.pid,
            runner: "node",
            body: JSON.parse(v8Command)
        }));
    };

}).call(WSV8DebuggerService.prototype);

});