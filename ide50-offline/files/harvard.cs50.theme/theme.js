define(function(require, exports, module) {

    // APIs consumed
    main.consumes = [
        'commands', 'layout', 'layout.preload', 'menus', 'Plugin', 'settings', 'ui'
    ];

    // APIs provided
    main.provides = ['c9.ide.cs50.theme'];

    // plugin
    return main;

    /**
     * Implements plugin.
     */
    function main(options, imports, register) {

        // https://lodash.com/docs
        var _ = require("lodash");

        // instantiate plugin
        var plugin = new imports.Plugin('CS50', main.consumes);

        // button for menu
        var button = null;

        // themes
        var themes = {
            dark: {
                ace: 'ace/theme/cloud9_night',
                class: 'cs50-theme-dark',
                skin: 'flat-dark', // default
                skins: ['dark', 'dark-gray', 'flat-dark']
            },
            light: {
                ace: 'ace/theme/cloud9_day',
                class: 'cs50-theme-light',
                skin: 'flat-light', // default
                skins: ['light', 'light-gray', 'flat-light']
            }
        };

        // when plugin is loaded
        plugin.on('load', function() {

            // create button
            button = new imports.ui.button({
                'command': 'toggleTheme',
                'skin': 'c9-menu-btn',
                'tooltip': 'Theme',
                'visible': true
            });

            // register command for button
            imports.commands.addCommand({
                exec: toggleTheme,
                group: 'CS50',
                name: 'toggleTheme'
            }, plugin);

            // load CSS for button
            imports.ui.insertCss(require('text!./style.css'), options.staticPrefix, plugin);

            // style button
            styleButton();
            
            // re-style button whenever theme changes
            imports.settings.on('user/general/@skin', function(value) {
                styleButton();
            }, plugin);

            // prefetch theme not in use
            if (button.getAttribute('class') == themes.dark.class) {
                imports['layout.preload'].getTheme(themes.light.skin, function() {});
            }
            else {
                imports['layout.preload'].getTheme(themes.dark.skin, function() {});
            }

            // insert button into menu
            imports.ui.insertByIndex(imports.layout.findParent({
                name: 'preferences'
            }), button, 0, plugin);
        });

        // when plugin is unloaded
        plugin.on('unload', function() {
            button = null;
        });

        // register plugin
        register(null, {
            'c9.ide.cs50.theme': plugin
        });

        /**
         * Styles button based on current theme.
         */
        function styleButton() {
            var skin = imports.settings.get('user/general/@skin');
            if (themes.dark.skins.indexOf(skin) !== -1) {
                button.setAttribute('class', themes.dark.class);
            }
            else {
                button.setAttribute('class', themes.light.class);
            }
        }
        
        /**
         * Toggles theme from dark to light or from light to dark.
         */
        function toggleTheme() {
            if (button.getAttribute('class') === themes.dark.class) {
                imports.layout.resetTheme(themes.light.skin, 'ace');
                imports.settings.set('user/ace/@theme', themes.light.ace);
            }
            else {
                imports.layout.resetTheme(themes.dark.skin, 'ace');
                imports.settings.set('user/ace/@theme', themes.dark.ace);
            }
        }
    }
});
