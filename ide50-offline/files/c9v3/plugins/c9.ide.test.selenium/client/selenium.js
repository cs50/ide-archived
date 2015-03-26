/**
 * Test Panel for the Cloud9
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

var ide = require("core/ide");
var ext = require("core/ext");
var util = require("core/util");

var fs = require("ext/filesystem/filesystem");
var newresource = require("ext/newresource/newresource");
var testpanel = require("ext/testpanel/testpanel");
var template = require("text!ext/selenium/selenium.template");
var markup = require("text!ext/selenium/selenium.xml");
var UiRecorderToWD = require("ext/selenium/converter");

function escapeXpathString(name) {
    if (name.indexOf('"') > -1) {
        var parts = name.split('"');
        var out = parts.map(function(part) {
            return part == '' ? "'\"'" : '"' + part + '"';
        });
        return "concat(" + out.join(", ") + ")";
    }
    return '"' + name + '"';
}

module.exports = ext.register("ext/selenium/selenium", {
    name: "Selenium Test Manager",
    dev: "Ajax.org",
    alone: true,
    type: ext.GENERAL,
    nodes: [],
    testpath: "test/selenium",
    template: template,
    markup: markup,

    hook: function(){
        var _self = this;
        ide.addEventListener("init.ext/testpanel/testpanel", function(){
            ext.initExtension(_self);
            _self.initTestPanel();
        });

        ide.addEventListener("init.testrunner", function(){
            ext.initExtension(_self);

            ide.removeEventListener("init.testrunner", arguments.callee);
        });
    },

    init: function(amlNode) {
        var _self = this;
        var nodes = seleniumSettings.childNodes;

        ide.addEventListener("init.ext/selenium/editor", function(){
            for (var i = 0, l = nodes.length; i < l; i++) {
                nodes.push(mnuRunSettings2.appendChild(nodes[0]));
            }
        });

        ide.addEventListener("test.expand.selenium", function(e) {
            var xmlNode = e.xmlNode;
            _self.reloadTestFile(xmlNode);
        });

        ide.addEventListener("test.hardstop", function(e) {
            //@todo clean up all events
        });

        ide.addEventListener("test.stop", function(e) {
            if (!_self.running) return;
            _self.stop();
        });

        ide.addEventListener("test.icon.selenium", function(e) {
            return "page_white_go.png";
        });

        ide.addEventListener("test.run.selenium", function(e) {
            _self.run(e.xmlNode, e.next);
        });
    },

    flashPlayerCount: 0,
    createFlashPlayer: function(dgName, playerName) {
        return new apf.flashplayer({
            id: playerName,
            margin: "4",
            src: "/static/ext/selenium/flowplayer-3.2.7.swf",
            flashvars: 'config=\\{"playerId":"player' + this.flashPlayerCount++
                + '","clip":\\{"url":"[{' + dgName
                + '.selected}::ancestor-or-self::node()/@video]","autoPlay":false,"scaling":"fit"\\}\\}',
            height: "100",
            visible: "{!![{" + dgName + ".selected}::ancestor-or-self::node()/@video]}",
            bgcolor: "000000",
            allowfullscreen: "true"
        });
    },

    initTestPanel: function(){
        var _self = this;

        this.nodes.push(
            mnuFilter.insertBefore(new apf.item({
                type: "radio",
                value: "selenium",
                caption: "Selenium Tests"
            }), mnuFilter.getElementsByTagNameNS(apf.ns.aml, "divider")[1]),

            mnuTestNew.appendChild(new apf.item({
                caption: "Selenium Test",
                onclick: function(){
                    _self.createAndOpenTest();
                }
            })),

            vboxTestPanel.appendChild(new apf.splitter({
                visible: "{flSeleniumMovie.visible}"
            }))

            //vboxTestPanel.appendChild(this.createFlashPlayer("dgTestProject", "flSeleniumMovie"))
        );

        (davProject.realWebdav || davProject).readdir(ide.davPrefix + "/" + this.testpath, function(data, state, extra) {
            if (state == apf.ERROR) {
                if (data && data.indexOf("jsDAV_Exception_FileNotFound") > -1) {
                    return;
                }

                //@todo
                return;
            }
            if (state == apf.TIMEOUT)
                return; //@todo

            var xml = apf.getXml(data);
            var nodes = xml.selectNodes("file");
            for (var i = 0; i < nodes.length; i++) {
                nodes[i].setAttribute("type", "selenium");
                mdlTests.appendXml(nodes[i], "repo[1]");
            }
        });
        
        // Create watchers to watch for stuff to happen on the filetree
        ide.addEventListener("beforewatcherchange", function(e) {
            switch (message.subtype) {
                case "remove":
                    
                    break;
                case "change":
                    
                    break;
                case "create":
                default:
                    break;
            }
            console.log("watcher",e);
        });
        
        // When a file is removed
        ide.addEventListener("removefile", function(e) {
            mdlTests.removeXml(mdlTests.queryNode("//file[@path=" + escapeXpathString(e.path) + "]"));
        });

        ide.addEventListener("afterfilesave", function(e) {
            var node = e.node;
            var name = (e.newpath || node.getAttribute("path")).replace(/^.*[\\\/]/, '');
            if (!name.match(/.stest$/))
                return;

            var fileNode = mdlTests.queryNode("//file[@path=" + escapeXpathString(e.newpath) + "]");
            if (!fileNode) {
                fileNode = apf.xmldb.getCleanCopy(node);
                fileNode.setAttribute("type", "selenium");
                apf.xmldb.appendChild(testpanel.findParent(e.newpath), fileNode);
            }
        });

        ide.addEventListener("socketMessage", function(e) {
            if (_self.disabled) return;

            var message = e.message;
            if ((message.type && message.type != "watcher") || !message.path)
                return;

            var path = message.path.slice(ide.workspaceDir.length);

            if (path != _self.testpath)
                return;

            switch (message.subtype) {
                case "create":
                    //Add file to model
                    break;
                case "remove":
                    //Remove file from model
                    break;
                case "change":
                    //Reread file and put tests update in model
                    var xmlNode = mdlTests.selectSingleNode("//file[@path=" + escapeXpathString(message.path) + "]");
                    _self.reloadTestFile(xmlNode);
                    break;
            }
        });

        this.enable();
    },

    run: function(fileNode, callback) {
        var _self = this;
        var path = fileNode.getAttribute("path");

        _self.lastTestNode = fileNode;

        _self.running = true;
        _self.stopping = false; //@todo this shouldn't happen
        _self.jobId = null;

        testpanel.setLog(fileNode, "reading");

        fs.readFile(path, function(data, state, extra) {
            if (state === apf.SUCCESS) {
                try {
                    var testObject = JSON.parse(data);
                }
                catch (e) {
                    testpanel.setError(fileNode,
                        "Invalid JSON. Could not parse file format: "
                        + e.message);

                    _self.running = false;
                    return callback();
                }

                _self.runSeleniumData(fileNode, testObject, callback, data);
            }
            else {
                testpanel.setError(fileNode,
                    "Could not load file contents: " + extra.message);

                _self.running = false;
                _self.stopping = false;

                if (!_self.stopping)
                    callback();

            }
        });
    },

    actionLookup: {
        "buttonDown" : "mousedown",
        "buttonUp"   : "mouseup",
        "doubleclick": "dblclick",
        "type"       : "keypress",
        "setTimeout" : "setWaitTimeout"
    },

    runSeleniumData: function(fileNode, testObject, callback, data) {
        var _self = this;
        var sp = new UiRecorderToWD();
        sp.realtime = false;

        _self.running = true;
        _self.stopping = false; //@todo this shouldn't happen
        _self.jobId = null;
        _self.nodes = [];
        _self.script = "";
            

        var tests = Object.keys(testObject).filter(function(prop) {
            if (typeof prop === "string")
                return prop;
        });

        var nodes = fileNode.selectNodes("test");
        if (!nodes.length) {
            dgTestProject.$setLoadStatus(fileNode, "loaded");
            _self.parseTestFile(data, fileNode);
            nodes = fileNode.selectNodes("test");
        }
        
        apf.asyncForEach(tests, function(name, nextTest, i) {
            if (_self.stopping) {
                testpanel.setError(fileNode, "Test Cancelled");
                _self.stopped();
                return;
            }
            
            // Push the test node
            _self.nodes.push(fileNode.selectNodes("test")[i]);
            
            if (name == 'require') {
                fs.readFile(ide.davPrefix + "/" + testObject[name], function(data, state) {
                    if (state === apf.SUCCESS) {
                        var requireObject = JSON.parse(data);
                        var code = "", nodes = [];
                        apf.asyncForEach(Object.keys(requireObject), function(reqName, reqNextTest) {
                            code = code + sp.compile(requireObject[reqName]);
                            reqNextTest();
                        },
                        function() {
                            _self.script = _self.script + code;
                            nextTest();
                        });
                    } 
                    else { 
                        testpanel.setError(fileNode, "File Not Found");
                    }
                });
            }
            else {
                _self.script = _self.script + sp.compile(testObject[name]);
                nextTest();
            }
            testpanel.setLog(fileNode, "running test " + (i + 1) + " of " + tests.length);
        },
        function() {
            var data = {
                command: "selenium",
                argv: ["selenium", _self.script],
                line: "",
                //cwd     : this.getCwd(),
                path: testObject.url || "",
                close: tests.length - 1,
                job: _self.jobId,
                url: testObject.url,
                where: ddWhere.value,
                os: ddSeOS.value,
                browser: ddSeBrowser.selected.getAttribute("value"),
                version: ddSeBrowser.selected.getAttribute("version"),
                quit: cbSeQuit.value
            };
            
            _self.testNodeIndex = 0;
            var actionIndex = -1;
            var assertIndex = -1;
            console.log('nodes', _self.nodes);
            
            ide.addEventListener("socketMessage", function(e) {
                // TODO: you can do better
                var testNode = _self.nodes[_self.testNodeIndex];
                var actions = testObject[_self.testNodeIndex];
                if (e.message.subtype == "selenium") {
                    var msg = e.message.body;
                    console.log(msg.cmd, msg);

                    switch (msg.type) {
                        case 0:
                            testpanel.setError(testNode, msg.err);
                            testpanel.setError(fileNode, msg.err);

                            ide.removeEventListener("socketMessage", arguments.callee);
                            if (_self.stopping)
                                _self.stopped();
                            else {
                                _self.running = false;
                                callback();
                            }
                            break;
                        case 1: //PASS .data[input | match]

                            var assertNode;
                            var actions = testNode.selectNodes("action");
                            if (actions.length) {
                                var actionNode = actions[actionIndex];
                                var asserts = actionNode.selectNodes("assert");

                                assertNode = asserts[++assertIndex];
                                if (asserts[assertIndex + 1])
                                    testpanel.setExecute(asserts[assertIndex + 1]);
                            }
                            else {
                                assertNode =
                                  apf.queryNode(testNode, "assert[@input="
                                    + escapeXpathString(msg.data.input || "")
                                    + " and @match="
                                    + escapeXpathString(msg.data.match || "")
                                    + "]");

                                if (!assertNode) {
                                    assertNode = testNode.ownerDocument
                                        .createElement("assert");
                                    assertNode.setAttribute("name",
                                        msg.data.input + " == " + msg.data.match);
                                    assertNode.setAttribute("input",
                                        msg.data.input);
                                    assertNode.setAttribute("match",
                                        msg.data.match);
                                    apf.xmldb.appendChild(testNode, assertNode);
                                }
                            }

                            if (assertNode)
                                testpanel.setPass(assertNode);
                            break;
                        case 2: //ERROR .data[input | match | measured]
                            if (_self.stopping)
                                return;

                            var assertNode, actionNode, asserts;
                            var actions = testNode.selectNodes("action");
                            if (actions.length && actionIndex > -1) {
                                actionNode = actions[actionIndex];
                                asserts = actionNode.selectNodes("assert");
                                assertNode = asserts[++assertIndex];
                            }

                            if (typeof msg.data == "string") {
                                var errorNode = testNode.ownerDocument
                                    .createElement("error");
                                errorNode.setAttribute("name", msg.data);
                                errorNode.setAttribute("status", 0);
                                errorNode = apf.xmldb.appendChild(testNode, errorNode, assertNode || actionNode && actionNode.nextSibling);
                                ide.dispatchEvent("test.pointer.selenium", {
                                    xmlNode: errorNode
                                });
                                return;
                            }

                            if (actions.length) {
                                if (asserts[assertIndex + 1])
                                    testpanel.setExecute(asserts[assertIndex + 1]);
                            }
                            else {
                                assertNode =
                                  apf.queryNode(testNode, "assert[@input="
                                    + escapeXpathString(msg.data.input || "")
                                    + " and @match="
                                    + escapeXpathString(msg.data.match || "")
                                    + "]");

                                if (!assertNode) {
                                    assertNode = testNode.ownerDocument
                                        .createElement("assert");
                                    assertNode.setAttribute("name",
                                        msg.data.input + " == " + msg.data.match);
                                    assertNode.setAttribute("input",
                                        msg.data.input);
                                    assertNode.setAttribute("match",
                                        msg.data.match);
                                    apf.xmldb.appendChild(testNode, assertNode);
                                }
                            }

                            if (assertNode)
                                testpanel.setError(assertNode, "Got: "
                                    + msg.data.measured);
                            break;
                        case 6: //CMD
                            var actions = testNode.selectNodes("action");
                            var actionNode = actions.length && actions[actionIndex+1];
                            if (actionNode) {
                                var actionName = actionNode.getAttribute("name");
                                if (msg.cmd=="waitFor") {
                                    var regexp = /\_\$elementExists\s*\(\s*(.*?)\s*\)\s*/;
                                    console.log(regexp.exec(msg.arguments));
                                }
                                    //console.log(testNode.querySelector('[element="' + ));
                                if ((_self.actionLookup[actionName] || actionName)
                                  == (_self.actionLookup[msg.cmd] || msg.cmd)) {
                                    testpanel.setExecute(actionNode);
                                    actionIndex++;
                                    assertIndex = -1;
                                }
                                // actionIndex++;
                            }
                        case 3: //LOG
                            testpanel.setLog(testNode, "command '"
                                + (msg.out || msg.cmd) + "'");
                            break;
                        case 4:
                            if (testNode.selectSingleNode("error|assert[@status=0]"))
                                testpanel.setError(testNode, "Test Failed");
                            else
                                testpanel.setPass(testNode);
                            
                            testNode.selectNodes("action").forEach(function(node) {
                                testpanel.setExecute(node);
                            });

                            //apf.xmldb.setAttribute(fileNode, "video", msg.video);

                            //Small hack
                            if (self.dgTestProject)
                                dgTestProject.reselect(); //Due to apf bug
                            if (self.dgUiRecorder)
                                dgUiRecorder.reselect(); //Due to apf bug
                            
                            // Commented because we now use this eventListener for ALL
                            //ide.removeEventListener("socketMessage", arguments.callee);

                            _self.testNodeIndex++;
                            break;
                        case 5:
                            _self.jobId = msg.job;
                            if (_self.cancelOnJobId)
                                _self.stop();
                            break;
                    }
                }
            });

            ide.send(data);
            
            /*var nodes = apf.queryNodes(fileNode, "test[@status=0 or error]");

            if (_self.stopping) {
                testpanel.setError(fileNode, "Test Cancelled");
                return;
            }
            else if (nodes.length)
                testpanel.setError(fileNode, "failed " + (nodes.length) + " tests of " + tests.length);
            else
                testpanel.setPass(fileNode, tests.length + " of " + tests.length);

            _self.running = false;

            callback();*/

        });
    },

    stop: function(){
        this.stopping = true;

        if (this.lastTestNode) {
            testpanel.setLog(this.lastTestNode.tagName == "file"
                ? this.lastTestNode
                : this.lastTestNode.parentNode, "Stopping...");
        }

        if (!this.jobId) {
            this.cancelOnJobId = true;
            return;
        }
        this.cancelOnJobId = false;

        var data = {
            command: "selenium",
            argv: ["selenium"],
            line: "",
            destroy: true,
            job: this.jobId
        };
        ide.send(data);
    },

    stopped: function(msg) {
        this.running = false;
        this.stopping = false;

        testpanel.stopped();

        ide.dispatchEvent("selenium.stopped");
    },

    createAndOpenTest: function() {
        var _self = this;
        var path = (this.testpath).split("/");
        var stack = [];

        var recur = function(){
            if (path.length === 0) {
                newresource.newfile(
                    ".stest",
                    _self.template,
                    ide.davPrefix + "/" + _self.testpath + "/");
                return;
            }

            stack.push(path.shift());

            (davProject.realWebdav || davProject).exists(ide.davPrefix + "/" + stack.join("/"), function(data, state, extra) {
                if (data) {
                    recur();
                }
                else {
                    (davProject.realWebdav || davProject).exec("mkdir",
                      [ide.davPrefix + "/", stack.join("/")], function(data) {
                        recur();
                    });
                }
            });
        }

        recur();
    },

    reloadTestFile: function(xmlNode) {
        var _self = this;
        fs.readFile(xmlNode.getAttribute("path"), function(data, state, extra) {
            if (state == apf.SUCCESS) {
                _self.parseTestFile(data, xmlNode);
            }
        });
    },

    parseTestFile: function(data, xmlNode) {
        var nodes = xmlNode.childNodes;
        for (var i = 0; i < nodes.length; i++) {
            apf.xmldb.removeNode(nodes[i]);
        }

        var doc = xmlNode.ownerDocument;
        Object.keys(JSON.parse(data))
            .filter(function(prop) { return prop.match(/^test /i); })
            .forEach(function(prop) {
                var node = doc.createElement("test");
                node.setAttribute("name", prop);

                apf.xmldb.appendChild(xmlNode, node);
        });
    },

    enable: function(){
        this.nodes.each(function(item) {
            item.enable();
        });

        ide.send({
            "command" : "watcher",
            "type"    : "watchFile",
            "path"    : this.testpath
        });

        this.disabled = false;
    },

    disable: function(){
        this.nodes.each(function(item) {
            item.disable();
        });

        ide.send({
            "command" : "watcher",
            "type"    : "unwatchFile",
            "path"    : this.testpath
        });

        this.disabled = true;
    },

    destroy: function(){
        this.nodes.each(function(item) {
            item.destroy(true, true);
        });
        this.nodes = [];
        testpanel.unregister(this);
    }
});

});
