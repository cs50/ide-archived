var parser     = require("treehugger/js/parse");
var traverse   = require("treehugger/traverse"); // enable traversals

function parse(input) {
    var doc    = input.toString().split(/\n/); // like document.getLines()
    var parsed = parser.parse(input);
    traverse.addParentPointers(parsed);
    
    var result = "";
    var tab    = "    ";
    var name, originalName;
    
    // Find first Comment Block
    var firstComment = [];
    if (doc[0].indexOf("/**") > -1) {
        var i = 0;
        while (doc[i].match(/^\s*\/?\*/))
            firstComment.push(doc[i++]);
        // firstComment.push(doc[i]);
    }
    firstComment = firstComment.join("\n");
    
    // Parse Inline Documentation
    parsed.traverseTopDown('Function("main", _, body)', function(b) {
        b.body.traverseTopDown(
          'Call(PropAccess(_, "freezePublicAPI"), [ObjectInit(args)])', 
          function(b, node) {
            var parent;
            
            node.traverseUp(
                "Function(f, _, _)", function(b) {
                    parent = b.f.value;
                    return this;
                }
            );
            
            // Check if we're in main - use the service name
            if (parent == "main") {
                parsed.traverseTopDown(
                  'Assign(PropAccess(Var("main"), "provides"), Array(plugins))', 
                  function(b) {
                    var p = b.plugins[0];
                    name = p && p[0].value;
                    originalName = name;
                });
            }
            // Else use the name of the function constructor
            else {
                name = parent;
            }
            
            if (!name) return;
            
            var pos    = node.getPos().sl - 1;
            var blocks = extractDocBlocks(doc, pos);
            var mainDoc = "";
            
            // Get the service names that this plugin depends on
            var consumes = [];
            parsed.traverseTopDown(
              'Assign(PropAccess(Var("main"), "consumes"), Array(plugins))', 
              function(b) {
                for (var i = 0; i < b.plugins.length; i++) {
                    consumes.push(b.plugins[i][0].value);
                }
            });
            
            for (var i = 0; i < blocks.length; i++) {
                if (blocks[i].indexOf("@event") > -1)
                    blocks[i] = treatEventBlock(blocks[i]);
                else if (!blocks[i].match(/\@(?:method|command|property|cfg|constructor)/)) {
                    mainDoc = blocks[i].replace(/^(\s*)\*+\//m, "$1*");
                    var prefix = "\n" + RegExp.$1 + "* ";
                    
                    if (mainDoc.indexOf("@class") == -1)
                        mainDoc += prefix + "@class " + name;
                    if (mainDoc.indexOf("@extends") == -1)
                        mainDoc += prefix + "@extends Plugin";
                    if (consumes.length)
                        mainDoc += prefix + "@requires " 
                            + consumes.join(prefix + "@requires ");
                    
                    mainDoc += "\n" + RegExp.$1 + "*/";
                    blocks[i] = mainDoc;
                }
            }
            
            var fname = name == "debugger" 
                ? "Debugger" : name.replace(/[-\.]/g, "_");
            result += firstComment + blocks.reverse().join("\n") 
                + "\nfunction " + fname + "(){\n";
            
            var found = {};
            for (var i = 0; i < b.args.length; i++) {
                var property = b.args[i];
                
                property.rewrite("PropertyInit(name, value)", function(b) {
                    if (found[b.name.value]) // No duplicates getter/setter
                        return;
                        
                    var name     = b.name.value;
                    var prop     = isProperty(b, node);
                    var pos      = property.getPos();
                    var blocks   = extractDocBlocks(doc, pos.sl - 1);
                    var events   = [];
                    
                    // Events will have comment blocks below it.
                    if (name == "_events") {
                        blocks = extractDocBlocks(doc, pos.el - 1, pos.sl - 1);
                        blocks = blocks.map(treatEventBlock);
                        result += blocks.join("\n");
                        return;
                    }
                    
                    var f;
                    for (var i = blocks.length - 1; i >= 0; i--) {
                        if (blocks[i].match(/@event\s+([^\s]*)/)) {
                            events.unshift(RegExp.$1);
                            blocks[i] = treatEventBlock(blocks[i]);
                        }
                        else if (blocks[i].indexOf("@ignore") > -1) {
                            blocks.splice(i, 1);
                        }
                        else if (!blocks[i].match(/\@(?:class|method|command|property|cfg|constructor)/)) {
                            f = i;
                        }
                    }
                    if (f !== undefined) {
                        blocks[f] = blocks[f]
                          .replace(/^(\s*)\*+\//m, "$1") 
                            + "* @" + (prop ? "property" : "method") + " " + name
                            + (events.length 
                                ? "\n" + RegExp.$1 + "* @fires " 
                                  + events.join("\n" + RegExp.$1 + "* @fires ") //.replace(/\./g, "-")
                                : "")
                            + "\n" + RegExp.$1 + "*/";
                    }
                    
                    result += tab + blocks.join("\n") + "\n" 
                        + tab + "this." + name + " = "
                        + (prop ? "something" : "function(){}")
                        + ";\n\n";
                    
                    found[b.name.value] = true;
                });
            }
            
            result += "\n}";
        });
    });
    
    // if (!name) return false;
    
    return {
        name   : originalName || name,
        result : result,
        firstComment : firstComment
    };
}

// Print consumes
// console.log()
// parsed.traverseTopDown(
// 	'Assign(PropAccess(Var("main"), "consumes"), Array(plugins))', function(b) {
//         console.log("consumes: " + b.plugins.toString());
// 	}
// );

// Print provides
// parsed.traverseTopDown(
//     'Assign(PropAccess(Var("main"), "provides"), Array(plugins))', function(b) {
//         console.log("provides: " + b.plugins.toString());
//     }
// );

function treatEventBlock(block){
    return block
        .replace("@cancellable", "@preventable")
        // .replace(/@event ([\w\.]+)/, function(m, n){
        //     return "@event " + n.replace(/\./g, "-");
        // });
}

function isProperty(property, node) {
    return property.value.rewrite(
        "Var(v)", function(b) {
            return false;
        },
        "Num(i)", function(b) {
            return true;
        },
        "Function(x, args, body)", function(b, node) {
            if (node.parent.kind === "set" || node.parent.kind === "get")
                return true;
            return false;
        },
        function() {
            return false;
        }
    );
}

function extractDocBlocks(doc, row, stop) {
    var blocks = [];
    var block;
    
    while ((block = find()) && !stop || row > stop) {
        if (block) 
            blocks.push(block);
        row--;
    }
    
    return blocks;
    
    function find() {
        var end = null;
        for (; row >= 0; row--) {
            var line = doc[row];
            for (var col = line.trimRight().length - 2; col >= 0; col--) {
                if (!end) {
                    if (line.substr(col, 2) === "*/") {
                        if (line.indexOf("***/") > -1)
                            return false;
                        
                        end = { sl: row, sc: col + 2 };
                        col--;
                    } else if (!line[col].match(/\s/) && !line.match(/^\/\//)) {
                        return false;
                    }
                } else if (line.substr(col, 2) === "/*") {
                    var rows = ["", line.substr(col)];
                    for (var r = row + 1; r < end.sl; r++)
                        rows.push(doc[r]);
                    rows.push(doc[end.sl].substr(0, end.sc));
                    if (end.sl === row)
                        rows = ["", line.substring(col + 3, end.sc)];
                    return rows.join("\n"); //filterDocumentation();
                }
            }
        }
    }
}

// function filterDocumentation(doc) {
//     return escapeHtml(doc)
//         .replace(/\n\s*\*\s*|\n\s*/g, "\n")
//         .replace(/\n\n(?!@)/g, "<br/><br/>")
//         .replace(/\n@(\w+)/, "<br/>\n@$1") // separator between summary and rest
//         .replace(/\n@param (\w+)/g, "<br/>\n<b>@param</b> <i>$1</i>")
//         .replace(/\n@(\w+)/g, "<br/>\n<b>@$1</b>");
// }

module.exports = parse;