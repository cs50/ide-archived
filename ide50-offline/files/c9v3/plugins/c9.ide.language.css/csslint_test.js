"use server";

if (typeof process !== "undefined") {
    require("amd-loader");
    require("../../test/setup_paths");
}

define(function(require, exports, module) {

var assert = require("ace/test/assertions");
//var handler = require('ext/jslanguage/jshint');
var LanguageWorker = require('plugins/c9.ide.language/worker').LanguageWorker;
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

module.exports = {

    "test integration base case" : function(next) {
        var emitter = Object.create(EventEmitter);
        emitter.emit = emitter._dispatchEvent;
        var worker = new LanguageWorker(emitter);
        var handler = require("plugins/c9.ide.language.css/css_handler");
        handler.analyze("#hello { color: 1px; } #nonused{}", null, function(markers) {
            assert.equal(markers.length, 2);
            next();
        });
    }
};

});

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec()
}
