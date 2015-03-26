define(function(require, exports, module) {

var fileIndexer = require("./file_indexer");
var assert = require("c9/assert");
var handler;

module.exports.init = function(_handler) {
    handler = _handler;
};

module.exports.outline = function(doc, ast, callback) {
    return fileIndexer.analyzeCurrent(handler.path, doc.getValue(), ast, { service: "outline" }, function(err, entry) {
        if (err) {
            console.error(err);
            return callback(); // can't pass error to this callback
        }
        
        var result = createOutline(null, entry);
        var rootInfo = {
            displayPos: { el: doc.getLength() - 1 }
        };
        result = addDisplayPos(result, rootInfo);
        result.isGeneric = true;
        callback(result);
    });
};

function createOutline(name, entry) {
    var result = {
        icon: entry.icon || entry.kind,
        name: name,
        pos: { sl: entry.row, sc: entry.column },
        items: []
    };
    if (!entry.properties)
        return result;
    assert(!Array.isArray(entry.properties));
    for (var uname in entry.properties) {
        entry.properties[uname].forEach(function(prop) {
            result.items.push(createOutline(uname.substr(1), prop));
        });
    }
    result.items = sortOutline(result.items);
    return result;
}

function sortOutline(items) {
    return items.sort(function(a, b) {
        return a.pos.sl - b.pos.sl;
    });
}

function addDisplayPos(outline, parent) {
    if (!outline.items)
        return outline;
    var last;
    for (var i = 0; i < outline.items.length; i++) {
        var item = outline.items[i];
        var next = outline.items[i + 1];
        var nextLine = next ? next.pos.sl : parent.displayPos.el;
        item.displayPos = item.pos;
        item.pos = {
            sl: item.pos.sl,
            sc: item.pos.sc,
            el: nextLine,
            ec: nextLine > item.pos.sl ? 0 : item.pos.ec
        };
        addDisplayPos(item, outline);
    }
    return outline;
}

});