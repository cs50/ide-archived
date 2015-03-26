/**
 * Ajax.org Code Editor (ACE)
 *
 * @copyright 2010, Ajax.org Services B.V.
 * @license LGPLv3 <http://www.gnu.org/licenses/lgpl-3.0.txt>
 * @author Fabian Jakobs <fabian AT ajax DOT org>
 */

if (typeof process !== "undefined") {
    require("amd-loader");
}

define(function(require, exports, module) {
"use strict";

var DevToolsMessage = require("./DevToolsMessage");
var assert = require("assert");

module.exports = {
    
    name: "DevToolsMessage",
    
    "test: parse message" : function() {
        var msgString = ["Destination:", "Tool:DevToolsService",
                "Content-Length:45", "",
                '{"command":"version","data":"0.1","result":0}'].join("\r\n");

        var msg = DevToolsMessage.fromString(msgString);

        var headers = msg.getHeaders();

        assert.equal("", headers["Destination"]);
        assert.equal("45", headers["Content-Length"]);
        assert.equal("DevToolsService", headers["Tool"]);

        assert.equal('{"command":"version","data":"0.1","result":0}', msg
                .getContent());
    },

    "test: stringify message" : function() {
        var msg = new DevToolsMessage();
        msg.setHeader("Destination", "");
        msg.setHeader("Tool", "DevToolsService");
        msg.setContent('{"command":"version","data":"0.1","result":0}');

        var msgString = ["Destination:", "Tool:DevToolsService",
                "Content-Length:45", "",
                '{"command":"version","data":"0.1","result":0}'].join("\r\n");

        assert.equal(msgString, msg.stringify());
    }
};

if (typeof module !== "undefined" && !module.parent)
    require("asyncjs").test.testcase(module.exports).exec()

});