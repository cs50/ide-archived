/**
 * Data base class for the Cloud9 Debugger.
 * @class debugger.Data
 */
/**
 * Retrieves an XML representation of this object.
 * @property {String} xml
 */
/**
 * Retrieves a json representation of thie object.
 * @property {String} json
 */
/**
 * Returns a string representation of this object (similar to {@link #xml})
 * @method toString
 * @return {String}
 */
/**
 * Determines whether the passed object is logically an exact copy.
 * @method equals
 * @param {Object} object
 */
define(function(require, exports, module) {
    
    function Data(props, sets, singletons) {
        this.$props = props || [];
        this.$sets = sets || [];
        this.$single = singletons || [];
        
        var _self = this;
        this.$props.concat(this.$sets).concat(this.$single).forEach(function(prop) {
            _self.__defineGetter__(prop, function(){ 
                return this.data[prop];
            });
            _self.__defineSetter__(prop, function(v) { 
                this.data[prop] = v;
            });
        })
    }
    Data.prototype = {
        get xml(){
            var str = "<" + this.tagName;

            var _self = this;
            this.$props.forEach(function(prop) {
                if (_self.data[prop] !== undefined)
                    str += " " + (prop + '="' 
                        + apf.escapeXML(_self.data[prop]) + '"');
            });
            
            if (!this.$sets.length && !this.$single.length)
                 str += " />";
            else {
                str += ">";
                if (this.$sets.length) {
                    this.$sets.forEach(function(prop) {
                        if (_self.data[prop])
                            str += _self.data[prop].join("");
                    });
                }
                if (this.$single.length) {
                    this.$single.forEach(function(prop) {
                        if (_self.data[prop])
                            str += _self.data[prop].toString();
                    });
                }
                str += "</" + this.tagName + ">";
            }
            
            return str;
        },
        set xml(v) {
            if (this.$sets.length)
                throw new Error("Sets not yet supported");
            
            var _self = this;
            this.$props.forEach(function(prop) {
               _self.data = {};
               _self.data[prop] = v.getAttribute(prop);
            });
        },
        get json(){
            return this.data;
        },
        set json(v) {
            this.data = v;
        },
        toString: function(){
            return this.xml;
        }
    };

    module.exports = Data;
    
});