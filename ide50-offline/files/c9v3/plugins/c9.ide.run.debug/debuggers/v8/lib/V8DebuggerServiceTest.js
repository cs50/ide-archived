/**
 * Ajax.org Code Editor (ACE)
 *
 * @copyright 2010, Ajax.org Services B.V.
 * @license LGPLv3 <http://www.gnu.org/licenses/lgpl-3.0.txt>
 * @author Fabian Jakobs <fabian AT ajax DOT org>
 */
 
if (typeof process !== "undefined")
    require("amd-loader");

define(function(require, exports, module) {
"use strict";

var assert = require("assert");
var MsgStreamMock = require("./MsgStreamMock");
var V8DebuggerService = require("./V8DebuggerService");

module.exports = {

    name: "V8DebuggerService",
    
    setUp: function(next) {
        this.$msgStream = new MsgStreamMock();
        this.$service = new V8DebuggerService(this.$msgStream);
        next()
    },

    sendMessage: function(destination, content) {
        var headers = {
            Tool: "V8Debugger",
            Destination: destination
        };
        this.$msgStream.$send(headers, content);
    },

    "test: attach" : function() {
        var called = false;
        this.$service.attach(2, function() {
            called = true;
        });
        this.sendMessage(2, '{"command":"attach","result":0}');

        assert.ok(called);
    },

    "test: detach" : function() {
        var called = false;
        this.$service.detach(2, function() {
            called = true;
        });
        this.sendMessage(2, '{"command":"detach", "result":0}');

        assert.ok(called);
    },

    "test: debugger command" : function() {
        var called = false;
        var data = '{"seq":1,"type":"request","command":"version"}';
        this.$service.debuggerCommand(2, data);
        this.sendMessage(2, '{"command":"debugger_command","result":0,"data":{"seq":1,"request_seq":1,"type":"response","command":"version","success":true,"body":{"V8Version":"2.1.10.5"},"refs":[],"running":true}}');
        assert.equal('{"command":"debugger_command","data":{"seq":1,"type":"request","command":"version"}}', this.$msgStream.requests[0].getContent());
    },

    "test: evaluate javascript" : function() {
        this.$service.evaluateJavaScript(2, "javascript:void(0);");
        assert.equal('{"command":"evaluate_javascript","data":"javascript:void(0);"}', this.$msgStream.requests[0].getContent());
    }
};

if (typeof module !== "undefined" && !module.parent)
    require("asyncjs").test.testcase(module.exports).exec()

});