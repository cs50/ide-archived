define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "format", "settings", "preferences"
    ];
    main.provides = ["format.jsbeautify"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var format = imports.format;
        var settings = imports.settings;
        var prefs = imports.preferences;
        
        var Range = require("ace/range").Range;
        var jsbeautify = require("./lib_jsbeautify");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var MODES = {
            "javascript" : "Javascript (JS Beautify)",
            "html"       : "HTML (JS Beautify)",
            "css"        : "CSS (JS Beautify)",
            "less"       : "Less (JS Beautify)",
            "xml"        : "XML (JS Beautify)",
            "json"       : "JSON (JS Beautify)",
            "handlebars" : "Handlebars (JS Beautify)",
        };
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            Object.keys(MODES).forEach(function(name) {
                format.addFormatter(MODES[name], name, plugin);
            });
            
            settings.on("read", function(){
                settings.setDefaults("user/format/jsbeautify", [
                    ["preserveempty", "true"],
                    ["keeparrayindentation", "false"],
                    ["jslinthappy", "false"],
                    ["braces", "end-expand"],
                    ["space_before_conditional", "true"],
                    ["unescape_strings", "true"]
                ]);
            });
            
            format.on("format", function(e) {
                if (MODES[e.mode])
                    return formatCode(e.editor, e.mode);
            });
            
            prefs.add({
                "Formatters" : {
                    position: 450,
                    "JS Beautify" : {
                        position: 100,
                        "Preserve Empty Lines": {
                            type: "checkbox",
                            path: "user/format/jsbeautify/@preserveempty",
                            position: 1000
                        },
                        "Keep Array Indentation": {
                            type: "checkbox",
                            path: "user/format/jsbeautify/@keeparrayindentation",
                            position: 2000
                        },
                        "JSLint Strict Whitespace": {
                            type: "checkbox",
                            path: "user/format/jsbeautify/@jslinthappy",
                            position: 3000
                        },
                        "Braces": {
                            type: "dropdown",
                            path: "user/format/jsbeautify/@braces",
                            width: "185",
                            position: 4000,
                            items: [
                                { value: "collapse", caption: "Braces with control statement" },
                                { value: "expand", caption: "Braces on own line" },
                                { value: "end-expand", caption: "End braces on own line" }
                            ]
                        },
                        "Space Before Conditionals": {
                            type: "checkbox",
                            path: "user/format/jsbeautify/@space_before_conditional",
                            position: 5000
                        },
                        "Unescape Strings": {
                            type: "checkbox",
                            path: "user/format/jsbeautify/@unescape_strings",
                            position: 6000
                        }
                    }
                }
            }, plugin);
        }
        
        /***** Methods *****/
        
        function formatCode(editor, mode) {
            if (this.disabled === true)
                return;
    
            var ace = editor.ace;
            var sel = ace.selection;
            var session = ace.session;
            var range = sel.getRange();
    
            // Load up current settings data
            var options = {
                space_before_conditional: settings.getBool("user/format/jsbeautify/@space_before_conditional"),
                keep_array_indentation: settings.getBool("user/format/jsbeautify/@keeparrayindentation"),
                preserve_newlines: settings.getBool("user/format/jsbeautify/@preserveempty"),
                unescape_strings: settings.getBool("user/format/jsbeautify/@unescape_strings"),
                jslint_happy: settings.getBool("user/format/jsbeautify/@jslinthappy"),
                brace_style: settings.get("user/format/jsbeautify/@braces")
            };
    
            if (session.getUseSoftTabs()) {
                options.indent_char = " ";
                options.indent_size = session.getTabSize();
            } else {
                options.indent_char = "\t";
                options.indent_size = 1;
            }
    
            var line = session.getLine(range.start.row);
            var indent = line.match(/^\s*/)[0];
            var trim = false;
    
            if (range.start.column < indent.length)
                range.start.column = 0;
            else
                trim = true;
    
            var value = session.getTextRange(range);
            var type = null;
    
            if (mode == "javascript" || mode == "json") {
                type = "js";
            } else if (mode == "css" || mode == "less"){
                type = "css";
            } else if (/^\s*<!?\w/.test(value)) {
                type = "html";
            } else if (mode == "xml") {
                type = "html";
            } else if (mode == "html") {
                if (/[^<]+?{[\s\-\w]+:[^}]+;/.test(value))
                    type = "css";
                else if (/<\w+[ \/>]/.test(value))
                    type = "html";
                else
                    type = "js";
            } else if (mode == "handlebars") {
                options.indent_handlebars = true;
                type = "html";
            }
    
            try {
                value = jsbeautify[type + "_beautify"](value, options);
                if (trim)
                    value = value.replace(/^/gm, indent).trim();
                if (range.end.column === 0)
                    value += "\n" + indent;
            }
            catch (e) {
                return false;
            }
    
            var end = session.diffAndReplace(range, value);
            sel.setSelectionRange(Range.fromPoints(range.start, end));
            
            return true;
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Beautify extension for the Cloud9 client
         *
         * Reformats the selected code in the current document
         * Processing/formatting code from https://github.com/einars/js-beautify
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            formatCode: formatCode
        });
        
        register(null, {
            "format.jsbeautify": plugin
        });
    }
});