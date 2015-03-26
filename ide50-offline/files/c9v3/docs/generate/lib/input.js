/**
 * Cloud9 Language Foundation
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = [
        "plugin", "c9", "settings", "ace", "tabs", "preferences", "browsersupport"
    ];
    main.provides = ["language"];
    return main;

    function main(options, imports, register) {
       
        
        /***** Register and define API *****/
        
        /**
         * Language foundation for Cloud9 
         * @event afterfilesave Fires after a file is saved
         *   object:
         *     node     {XMLNode} description
         *     oldpath  {String} description
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            isContinuousCompletionEnabled : isContinuousCompletionEnabled,
            
            /**
             * 
             */
            setContinuousCompletionEnabled : setContinuousCompletionEnabled,
            
            /**
             * Registers a new language handler.
             * @param modulePath  the require path of the handler
             * @param contents    (optionally) the contents of the handler script
             * @param callback    An optional callback called when the handler is initialized
             */
            registerLanguageHandler : registerLanguageHandler,
            
            /**
             * 
             */
            isInferAvailable : isInferAvailable
        });
        
        register(null, {
            language: plugin
        });
    }
});
 
    
/* Move to appropriate plugins
        marker.addMarkers({data:[]}, this.editor);
    },

    destroy: function () {
        // Language features
        marker.destroy();
        complete.destroy();
        refactor.destroy();
        this.$destroy();
*/
