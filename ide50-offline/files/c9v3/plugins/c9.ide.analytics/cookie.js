define(function(require, exports, module) {
    "use strict";

    /**
     * Cookie plugin
     */
    main.provides = ["c9.analytics.cookie"];
    
    module.exports = main;
    
    function main(options, imports, register) {
                
        /**
         * Get a cookie based on its parameter name
         * @param {String} cname The parameter name
         */
        function getCookie(cname) {
            var name = cname + "=";
            if (document.cookie) {
                var ca = document.cookie.split(';');
                for (var i = 0; i < ca.length; i++) {
                    var c = ca[i];
                    while (c.charAt(0) == ' ') c = c.substring(1);
                    if (c.indexOf(name) != -1) return b64_to_utf8(c.substring(name.length,c.length));
                }
            }
            return "";
        }
         
        /**
         * Set a basic cookie with a single parameter, to track things like "Viewed Cloud9 website"
         * @param {String} cname The parameter name
         * @param {String} cvalue The parameter value
         * @param {Number} exdays Days for expiration
         */
        function setCookie(cname, cvalue, exdays) {
            var d = new Date();
            d.setTime(d.getTime() + (exdays * 24 * 60 * 60 *1000));
            var expires = "expires=" + d.toUTCString();
            var encodedCValue = utf8_to_b64(cvalue);
            document.cookie = cname + "=" + encodedCValue + "; " + expires;
        }
        
        /**
         * Encode (cookie) string UTF8 to Base64
         * See https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
         * @param {String} str The string to encode
         * @return {String} The Base64 encoded string
         */
        function utf8_to_b64(str) {
            return window.btoa(unescape(encodeURIComponent(str)));
        }
        
        /**
         * Decode (cookie) string Base64 to UTF8
         * See https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
         * @param {String} str The string to decode
         * @return {String} The UTF8 decoded string
         */
        function b64_to_utf8(str) {
            try {
                return decodeURIComponent(escape(window.atob(str)));
            }
            catch (e) {
                // not properly B64 encoded, should just return the original
                return str;
            }
        }
        
        /***** Register and define API *****/
        
        register(null, {
            "c9.analytics.cookie": {
                get: getCookie,
                set: setCookie
            }
        });
    }
});
