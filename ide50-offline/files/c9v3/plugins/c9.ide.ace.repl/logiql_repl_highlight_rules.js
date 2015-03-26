/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2012, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;
var LogiQLHighlightRules = require("ace/mode/logiql_highlight_rules").LogiQLHighlightRules;

var LogiQLReplHighlightRules = function() {    
    this.$rules = {
        start: [
            {token: "string", regex : "Welcome"},
            {defaultToken: "comment"}
        ],
        input: [{
            onMatch: function(val) {
                return [
                    {value: val, type: "constant"},
                    {value: "Upload File", type: "button"}
                ]
            }, regex: "--?file$"
        }, {
            onMatch: function(val) {
                return [
                    {value: " " + val.slice(1, -1) + " ", type: "constant.special"}
                ];
            }, regex: "\x01.*?\x02"
        }, {
            token: ["constant", "support.function"],
            regex: "(--?)([\\w]+\\b)"
        }, {
            token: "support.function",
            regex: "\\b(lb|ws|exec|replaceblock|addblock)\\b" // TODO add more keywords
        }, {
            token: "identifier",
            regex: "[\\w\\-]+"
        }, {
            token: "string",
            regex: "'",
            push: "logiql-start"
        }],
        output: [
            {token: "string", regex : "$"},
            {defaultToken: "repl-output"}
        ],
        "logiql-start": [{
            token: "string",
            regex: "'",
            next: "pop"
        }]
    };
    
    this.embedRules(LogiQLHighlightRules, "logiql-", [{
        token: "string",
        regex: "'",
        next: "pop"
    }]);
    
    this.normalizeRules();
};

oop.inherits(LogiQLReplHighlightRules, TextHighlightRules);

exports.LogiQLReplHighlightRules = LogiQLReplHighlightRules;
});