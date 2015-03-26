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
var DevToolsService = require("./DevToolsService");

module.exports = {

    name: "DevToolsService",
    
    setUp: function() {
        this.$msgStream = new MsgStreamMock();
        this.$service = new DevToolsService(this.$msgStream);
    },

    sendMessage: function(content) {
        this.$msgStream.$send(null, content);
    },

    "test: ping" : function() {
        var called = false;
        this.$service.ping(function() {
            called = true;
        });
        this.sendMessage('{"command":"ping", "result":0, "data":"ok"}');

        assert.ok(called);
    },

    "test: getVersion" : function() {
        var called = false;
        this.$service.getVersion(function(version) {
            called = true;
            assert.equal("0.1", version);
        });
        this.sendMessage('{"command":"version","data":"0.1","result":0}');

        assert.ok(called);
    },

    "test: listTabs" : function() {
        var called = false;
        this.$service.listTabs(function(tabs) {
            called = true;
            assert.equal(1, tabs.length);
            assert.equal(2, tabs[0].length);
            assert.equal(2, tabs[0][0]);
            assert.equal("file:///index.html", tabs[0][1]);
        });
        this.sendMessage('{"command":"list_tabs","data":[[2,"file:///index.html"]],"result":0}');

        assert.ok(called);
    }
};

if (typeof module !== "undefined" && !module.parent)
    require("asyncjs").test.testcase(module.exports).exec()

});