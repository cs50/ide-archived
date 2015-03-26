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
var V8Message = require("./V8Message");

module.exports = {

    name: "V8Message",
    
    "test: create message": function() {
        var msg = new V8Message("request");
        assert.equal("request", msg.type);
    },

    "test: two messages have different sequence numbers": function() {
        var msg1 = new V8Message("request");
        var msg2 = new V8Message("request");

        assert.ok(msg1.seq !== msg2.seq);
    }

};

if (typeof module !== "undefined" && !module.parent)
    require("asyncjs").test.testcase(module.exports).exec()

});