define(function(require, exports, module) {
    var oop = require("ace/lib/oop");
    var BaseClass = require("ace_tree/data_provider");

    function DataProvider(root) {
        BaseClass.call(this, root || {});

        this.rowHeight = 19;
        this.rowHeightInner = 18;

        Object.defineProperty(this, "loaded", {
            get: function(){ return this.visibleItems.length; }
        });
    }

    oop.inherits(DataProvider, BaseClass);

    (function() {
        this.$sortNodes = false;

        this.getEmptyMessage = function(){
            return "No open files";
        };
        
        this.getRowIndent = function(node) {
            return node.$depth ? node.$depth - 1 : 0;
        };
        
        this.getClassName = function(datarow) {
            return datarow.className || "";
        };

        this.getIconHTML = function (datarow) {
            var tab = datarow.tab;
            if (!tab)
                return "";

            var className = tab.document.meta.saving || (tab.document.changed && "changed");
            var html = "<strong class='close " + className + "'> </strong>";

            return html;
        };

    }).call(DataProvider.prototype);

    return DataProvider;
});