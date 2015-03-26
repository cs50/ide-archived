/**
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

// contains language specific debugger bindings
define(function(require, exports, module) {

    var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
    
    var expressionBuilder = module.exports = Object.create(baseLanguageHandler);
    
    /*** publics ***/
    
    expressionBuilder.handlesLanguage = function(language) {
        return language === "javascript" || language === "jsx";
    };
        
    // builds an expression for the v8 debugger based on a node
    expressionBuilder.getInspectExpression = function(doc, fullAst, pos, currentNode, callback) {
        if (!currentNode) return callback();
        
        callback(getExpression(currentNode));
    };
    
    /*** privates ***/
    
    // get a string value of any expression
    var getExpression = function(d) {
        if (d.value)
            return { value: d.value, pos: d.getPos() };
        
        var result;
        
        // TODO: simplify this; we can simply get the string
        
        d.rewrite(
            // var someVar = ...
            'VarDeclInit(x, _)', 'ConstDeclInit(x, _)', function(b) {
                d = b.x;
                result = b.x.value;
            },
            // var someVar;
            'VarDecl(x)', 'ConstDecl(x)', function(b) {
                d = b.x;
                result = b.x.value;
            },
            // e.x
            'PropAccess(e, x)', function(b) {
                result = getExpression(b.e) + "." + b.x.value;
            },
            // x
            'Var(x)', function(b) {
                result = b.x.value;
            },
            // 10
            'Num(n)', function(b) {
                result = b.n.value;
            },
            // e[idx]
            'Index(e, idx)', function(b) {
                result = getExpression(b.e) + "[" + getExpression(b.idx) + "]";
            },
            // new SomeThing(arg, ...)
            'New(e, args)', function(b) {
                var method = getExpression(b.e);
                var args = b.args.toArray().map(getExpression).join(", ");
                result = "new " + method + "(" + args + ")";
            },
            // x (function argument)
            'FArg(x)', function(b) {
                result = b.x.value;
            },
            // 10 + 4
            'Op(op, e1, e2)', function(b) {
                result = getExpression(b.e1) + " " + b.op.value + " " + getExpression(b.e2);
            },
            // if nuthin' else matches
            function() {
                if (!result)
                    result = "";
            }
        );
        
        if (result === "")
            return;
        
        return { value: result, pos: d.getPos() };
    };

});
