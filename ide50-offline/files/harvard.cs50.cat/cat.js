define(function(require, exports, module) {

    // APIs consumed
    main.consumes = [
        'layout', 'Plugin', 'settings', 'ui'
    ];

    // APIs provided
    main.provides = ['c9.ide.cs50.cat'];

    // plugin
    return main;

    /**
     * Implements plugin.
     */
    function main(options, imports, register) {

        // instantiate plugin
        var plugin = new imports.Plugin('CS50', main.consumes);

        // button for menu
        var button = null;

        // when plugin is loaded
        plugin.on('load', function() {

            // create button
            button = new imports.ui.button({
                'skin': 'c9-menu-btn',
                'visible': true
            });

            // load CSS for button
            button.setAttribute('class', 'cs50-cat');
            imports.ui.insertCss(require('text!./style.css'), options.staticPrefix, plugin);

            // insert button into menu
            imports.ui.insertByIndex(imports.layout.findParent({
                name: 'preferences'
            }), button, 1000, plugin);
        });

        // when plugin is unloaded
        plugin.on('unload', function() {
            button = null;
        });

        // register plugin
        register(null, {
            'c9.ide.cs50.cat': plugin
        });
    }
});
