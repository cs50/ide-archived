/**
 * Cloud9 Logging Utils
 *
 * @copyright 2013, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Double digits
    exports.dd = function(n) {
        return n < 10 ? "0" + n : "" + n;
    };

    // Formatting the date nicely
    exports.formatDate = function(date) {
        return months[date.getUTCMonth()] + " " + this.dd(date.getUTCDate()) +
            " " + this.dd(date.getUTCHours()) + ":" + this.dd(date.getUTCMinutes()) +
            ":" + this.dd(date.getUTCSeconds());
    };
    
    exports.reqToken = function(req, token, field) {
        return this.connectLogger[token](req, null, field);
    };
    
    exports.formatImmediateRequest = function(req) {
        return [this.reqToken(req, 'method'), this.reqToken(req, 'url'), this.reqToken(req, 'req', 'X-Forwarded-For'),
            this.reqToken(req, 'remote-addr'), this.reqToken(req, 'referrer')].join(" ");
    };
    
    exports.formatCompletedRequest = function(req, data) {
        return [this.reqToken(req, 'method'), this.reqToken(req, 'url'), "- COMPLETE -",
            data.status, data.duration, "ms"].join(" ");
    };

});