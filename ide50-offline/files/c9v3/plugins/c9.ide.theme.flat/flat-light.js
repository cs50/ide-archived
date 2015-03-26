define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "layout", "menus", "tabinteraction", "settings",
        "dialog.notification"
    ];
    main.provides = ["theme.flat-light"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var menus = imports.menus;
        var settings = imports.settings;
        var layout = imports.layout;
        var tabinteraction = imports.tabinteraction;
        var notify = imports["dialog.notification"].show;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var oldHeight, oldMinimizedHeight, oldTabInteraction, svg, oldTabDelta;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            var update = function(e){
                if (e.theme == "flat-light") {
                    layout.getElement("logobar").setHeight(40);
                    oldHeight = menus.height;
                    oldMinimizedHeight = menus.minimizedHeight;
                    oldTabInteraction = tabinteraction.plusMargin;
                    oldTabDelta = apf.tabRightDelta;
                    
                    menus.height = 40;
                    menus.minimizedHeight = 8;
                    
                    tabinteraction.plusMargin = 14;
                    apf.tabRightDelta = 25;
                    
                    settings.set("user/ace/cursorStyle", "smooth slim");
                }
                else if (e.oldTheme == "flat-light") {
                    layout.getElement("logobar").setHeight(31);
                    
                    menus.height = oldHeight;
                    menus.minimizedHeight = oldMinimizedHeight;
                    
                    tabinteraction.plusMargin = oldTabInteraction;
                    apf.tabRightDelta = oldTabDelta;
                    
                    settings.set("user/ace/cursorStyle", "ace");
                }
                
                setGeckoMask();
            };
            
            layout.on("themeChange", update);
            
            if (layout.theme == "flat-light")
                update({ theme: layout.theme });
            else if (!settings.getBool("user/theme/@ask-flat-light") && false) {
                var hideThemeSwitch = notify("<div class='c9-theme-switch'>"
                    + "The <a href='#' target='_blank'>Flat Light Theme</a> is "
                    + "now available. Click here to switch.</div>", true);
                
                document.querySelector(".c9-theme-switch").addEventListener("click", function(){
                    hideThemeSwitch();
                    settings.set("user/general/@skin", "flat-light");
                    layout.updateTheme();
                }, false);
                
                settings.set("user/theme/@ask-flat-light", true);
            }
            
            setGeckoMask();
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            emit("draw");
        }
        
        /***** Methods *****/
        
        // There will be a better place for this when theming is fully
        // abstracted. For now this is a hack
        function setGeckoMask(){
            if (!apf.isGecko) return;
            
            if (svg) svg.parentNode.removeChild(svg);
            
            var isFlatTheme = layout.theme.indexOf("flat") > -1;
            var img = "/static/plugins/c9.ide.layout.classic/images/" + (
                isFlatTheme
                    ? "gecko_mask_flat_light.png"
                    : "gecko_mask.png");
            var width = isFlatTheme ? 76 : 46;
            var height = isFlatTheme ? 26 : 24;
            var x1 = isFlatTheme ? 1 : 1;
            var x2 = isFlatTheme ? -40 : -28;
            
            document.body.insertAdjacentHTML("beforeend", '<svg xmlns="http://www.w3.org/2000/svg">'
                + '<defs>'
                    + '<mask id="tab-mask-left" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">'
                        + '<image width="' + width + 'px" height="' + height + 'px" xlink:href="' + img + '" x="' + x1 + 'px"></image>'
                    + '</mask>'
                    + '<mask id="tab-mask-right" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">'
                        + '<image width="' + width + 'px" height="' + height + 'px" xlink:href="' + img + '" x="' + x2 + 'px"></image>'
                    + '</mask>'
                + '</defs>'
            + '</svg>');
            
            svg = document.body.lastChild;
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            svg.parentNode.removeChild(svg);
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            "theme.flat-light": plugin
        });
    }
});