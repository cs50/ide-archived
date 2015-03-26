#!/usr/bin/env node

var execFile = require("child_process").execFile;
var fs = require("fs");

var PATH = "../plugins";

var skins = {};
execFile("nak", ["-l", PATH], {}, function(err, stdout, stderr) {
    var files = stdout.split("\n");
    console.log("Processing", files.length, "files");
    
    files.forEach(function(file) {
        var data;
        
        if (file.match(/\.xml$/)) {
            data = fs.readFileSync(file, "utf8");
            
            if (!data.match(/skinset\s*=/) && data.indexOf('<a:application') > -1) {
                // Tags
                data.replace(/<([\w\:\-]+)/g, function(m, v) {
                    skins[v.split(":").pop()] = true;
                });
                
                // Skins
                data.replace(/skin[\s\r\n]*=[\s\r\n]*["']([\w\-]+)["']/g, function(m, v) {
                    skins[v] = true;
                });
            }
        }
        else if (file.match(/\.js$/)) {
            data = fs.readFileSync(file, "utf8");
                
            //Tags
            data.replace(/new (?:apf|ui).([\w]+)/g, function(m, v) {
                skins[v] = true;
            });
            
            // Skins
            data.replace(/skin\s*:\s*["']([\w\-]+)["']/g, function(m, v) {
                skins[v] = true;
            });
        }
        else {
            // Ignore the rest
        }
    });
    
    console.log(skins);
    
    function client(){
        var skins = { model: true,
          application: true,
          hsplitbox: true,
          vsplitbox: true,
          textbox: true,
          list: true,
          each: true,
          caption: true,
          span: true,
          bar: true,
          div: true,
          h1: true,
          p: true,
          searchbox: true,
          lineselect: true,
          item: true,
          window: true,
          vbox: true,
          hbox: true,
          label: true,
          spinner: true,
          button: true,
          'bk-window': true,
          'btn-default-css3': true,
          AmlEvent: true,
          Class: true,
          xmlset: true,
          resize: true,
          http: true,
          AmlDocument: true,
          AmlAttr: true,
          AmlText: true,
          aml: true,
          AmlCDATASection: true,
          AmlNode: true,
          AmlComment: true,
          AmlDocumentFragment: true,
          AmlNamespace: true,
          AmlNamedNodeMap: true,
          AmlTextRectangle: true,
          XiInclude: true,
          AmlCharacterData: true,
          AmlConfiguration: true,
          AmlElement: true,
          XhtmlElement: true,
          actiontracker: true,
          GuiElement: true,
          validator: true,
          ValidationGroup: true,
          errorbox: true,
          apf: true,
          Sort: true,
          DataBinding: true,
          MultiselectBinding: true,
          selection: true,
          StandardBinding: true,
          MultiSelect: true,
          Presentation: true,
          url: true,
          scrollbar: true,
          visibilitymanager: true,
          zmanager: true,
          DOMParser: true,
          CodeCompilation: true,
          ruleList: true,
          UndoData: true,
          BindingRule: true,
          BaseButton: true,
          BaseTree: true,
          BaseList: true,
          BaseSimple: true,
          Teleport: true,
          ViewPortAml: true,
          ViewPortHtml: true,
          state: true,
          BaseTab: true,
          AmlProcessingInstruction: true,
          divider: true,
          group: true,
          menu: true,
          btn_icon_only: true,
          divider_console: true,
          vertically: true,
          options: true,
          layout: true,
          'panel-bar': true,
          'toolbar-top': true,
          'c9-menu-btn': true,
          modalwindow: true,
          checkbox: true,
          dropdown: true,
          img: true,
          filler: true,
          'bk-window2': true,
          checkbox_black: true,
          black_dropdown: true,
          simpleimg: true,
          'c9-divider-hor': true,
          page: true,
          tab: true,
          basic: true,
          'c9-divider-double': true,
          'dropdown-dark-glossy': true,
          datagrid: true,
          BindingColumnRule: true,
          actions: true,
          codebox: true,
          checkbox_grey: true,
          appsettings: true,
          sbios: true,
          'c9-menu-bar': true,
          templates: true,
          html: true,
          head: true,
          title: true,
          body: true,
          results: true,
          message: true,
          'c9-toolbarbutton-glossy': true,
          'btn-preview-nav': true,
          'btn-preview-choice': true,
          simplebox: true,
          list_dark: true,
          tab_console: true,
          splitbutton: true,
          'run-splitbutton': true,
          'button--': true,
          column: true,
          insert: true,
          remove: true,
          expanded: true,
          'c9-toolbarbutton-light': true,
          'header-btn': true,
          splitter: true,
          dd: true,
          css: true,
          drag: true,
          drop: true,
          browser: true,
          'c9-toolbarbutton': true,
          tbsimple: true,
          'browser-btn': true,
          flashplayer: true,
          table: true,
          data: true,
          platform: true,
          local: true,
          toolbar: true,
          password: true,
          textarea: true,
          radiobutton: true,
          colorbox: true,
          frame: true,
          cboffline: true,
          blackbutton: true,
          tag: true,
          skin: true,
          input: true }
        
        app.http.request("/static/plugins/c9.ide.layout.classic/skins.xml", {}, function(err, data) {
            var parsed = apf.getXml(data);
            
            var xml = [];
            var css = [];
            
            var nodes = parsed.childNodes;
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].nodeType != 1)
                    continue;
                var node = nodes[i];
                var name = node.getAttribute("name");
                if (skins[name]) {
                    var combined = [];
                    apf.queryNodes(node, "a:style").forEach(function(snode) {
                        combined.push(snode.textContent);
                        snode.parentNode.removeChild(snode);
                    });
                    css.push([name, combined.join("\n").split("\n").map(function(line) {
                        return line.replace(/^ {8}/, "");
                    }).join("\n")]);
                    xml.push(nodes[i].xml);
                }
            }
            
            app.fs.writeFile("/skins.xml", 
                "<?xml version='1.0'?>\n"
                + '<a:skin xmlns:a="http://ajax.org/2005/aml">\n'
                + xml.join("\n").replace(/xmlns:a="http:\/\/ajax\.org\/2005\/aml"/g, "")
                + "</a:skin>", function(){});
            
            css.forEach(function(item) {
                app.fs.writeFile("/css/" + item[0] + ".css", item[1], function(){})
            });
        });
    }
});
