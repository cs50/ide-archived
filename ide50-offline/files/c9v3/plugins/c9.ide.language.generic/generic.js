/**
 * Code completion for the Cloud9
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
define(function(require, exports, module) {
    main.consumes = ["language"];
    main.provides = [];
    return main;

    console.log("hi dan");

    function main(options, imports, register) {
        var language = imports.language;
        var snippets = require("./snippet_loader");

        language.registerLanguageHandler('plugins/c9.ide.language.generic/local_completer');
        language.registerLanguageHandler('plugins/c9.ide.language.generic/snippet_completer');
        language.registerLanguageHandler("plugins/c9.ide.language.generic/mode_completer");
        language.registerLanguageHandler('plugins/c9.ide.language.generic/open_files_local_completer');
        language.registerLanguageHandler('plugins/c9.ide.language.generic/simple/shell');
        language.registerLanguageHandler('plugins/c9.ide.language.generic/simple/php');
        language.registerLanguageHandler('plugins/c9.ide.language.generic/simple/make');

        language.once("initWorker", function(e) {
            snippets.init(e.worker);
        });
        
        register(null, {});
    }
});