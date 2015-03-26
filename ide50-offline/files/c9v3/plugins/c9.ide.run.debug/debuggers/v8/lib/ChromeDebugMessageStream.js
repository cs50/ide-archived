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

var ChromeDebugMessageStream = module.exports = function(socket) {
    this.$socket = socket;
};

(function() {

    Util.implement(this, EventEmitter);

    this.$received = "";

    this.connect = function() {
        var socket = this.$socket;
        var self = this;
        socket.on("connect", function() {
            self.$onconnect();
        });
        socket.on("data", function(data) {
            self.$onhandshake(data);
        });
        socket.connect();
    };

    this.sendRequest = function(message) {
        //console.log("> Sent to Chrome:\n", message.stringify());
        this.$socket.send(message.stringify());
    };

    this.$onconnect = function() {
        this.$socket.send(this.MSG_HANDSHAKE);
    };

    this.$onhandshake = function(data) {
        this.$received += data;
        //this.$socket.clearBuffer();

        if (this.$received.length < this.MSG_HANDSHAKE.length)
            return;

        if (this.$received.indexOf(this.MSG_HANDSHAKE) !== 0) {
            this.$socket.removeAllListeners("data");
            return this.$onerror();
        }

        this.$received = this.$received.substring(this.MSG_HANDSHAKE.length);
        this.$socket.removeAllListeners("data");
        this.$reader = new MessageReader(this.$socket, this.$onMessage.bind(this));

        this.emit("connect");
    };

    this.$onMessage = function(messageText) {
        var self = this;
        setTimeout(function() {
            //console.log("> Received from Chrome:\n", messageText);
            var response = new DevToolsMessage.fromString(messageText);
            self.emit("message", {data: response});
        }, 0);
    };

    this.$onerror = function() {
        this.emit("error");
    };

    this.MSG_HANDSHAKE = "ChromeDevToolsHandshake\r\n";

}).call(ChromeDebugMessageStream.prototype);

});