/**
 * Ajax.org Code Editor (ACE)
 *
 * @copyright 2010, Ajax.org Services B.V.
 * @license LGPLv3 <http://www.gnu.org/licenses/lgpl-3.0.txt>
 * @author Fabian Jakobs <fabian AT ajax DOT org>
 */
 
define(function(require, exports, module) {
"use strict";

var util = require("./util");
var DevToolsMessage = require("./DevToolsMessage");

var MsgStreamMock = module.exports = function() {

    util.implement(this, util.EventEmitter);

    var self = this;
    this.requests = [];
    this.sendRequest = function(message) {
        self.requests.push(message);
    };

    this.$send = function(headers, content) {
        var msg = new DevToolsMessage(headers, content);
        this.emit("message", {data: msg});
    };
};

});