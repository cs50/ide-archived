define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "tabManager"
    ];
    main.provides = ["terminal.monitor.message_view"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var Plugin = imports.Plugin;
        var tabManager = imports.tabManager;
        
        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var handleEmit = plugin.getEmitter();
        var css = require("text!./message_view.css");
        var html = require("text!./message_view.html");
        
        var messageStack = [];

        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            // Load CSS
            ui.insertCss(css, options.staticPrefix, plugin);
            
            tabManager.on("tabAfterReparent", function(item) {
                repositionMessages(item.tab);
            });
            tabManager.on("tabAfterActivateSync", function() {
                toggleMessages();
            });
        }
        
        function handleClick(e) {
            switch (e.target.getAttribute("data-type")) {
                case "preview": 
                    handlePreview(e);    
                default:
                    hide();
            }
        }
        
        function handlePreview(e) {
            e.preventDefault();
            tabManager.open({
                editorType: "preview",
                active: true,
                document: {
                    preview: {
                        path: e.target.innerText
                    }
                }
            }, function(err, tab) {});
        }
        
        function isAlreadyShowingMessage(messages, text) {
            return messages.some(function(message) {
                return message.text == text;
            });
        }
        
        function toggleMessages() {
            messageStack.forEach(function(message) {
                if (message.tab.active) {
                    message.domNode.style.display = 'block';
                } else {
                    message.domNode.style.display = 'none';
                }
            });
        }
        
        function showMessage(message, referenceMessage) {
            var messageNode = message.domNode;
            var referenceNode = message.tab.aml.$pHtmlNode.querySelector('.session_page.curpage');
            var referenceBoundingRect = referenceNode.getBoundingClientRect();
            var offset = { top: 8, left: 8, right: 8, bottom: 8 };
            var width = referenceBoundingRect.width - offset.right - offset.left;
            var right = window.innerWidth - referenceBoundingRect.right + offset.right;
            var top;
            
            if (referenceMessage) {
                top = referenceMessage.domNode.getBoundingClientRect().bottom + offset.bottom;
            } else {
                top = referenceBoundingRect.top + offset.top;
            }
            
            messageNode.style.display = 'block';
            messageNode.style.top = top + 'px';
            messageNode.style.right = right + 'px';
            messageNode.style.width = width + 'px';
            
            setTimeout(function() {
                messageNode.style.opacity = 1;
            });
        }
        
        function createMessageNode(text) {
            var messageNode = ui.insertHtml(null, html, plugin)[0];
            var contentNode = messageNode.querySelector(".message");
            contentNode.innerHTML = text;
            contentNode.onclick = handleClick;
            return messageNode;
        }
        
        function setupMessageAction(message, action) {
            if (!action)
                return;
            
            var actionNode = message.domNode.querySelector(".cmd");
            var caption = message.domNode.querySelector(".caption");
            caption.innerHTML = action.label;
            actionNode.style.display = 'block';
            actionNode.onclick = function() {
                caption.innerHTML = "Please wait...";
                handleEmit('action', action.cmd, message);
            };
        }
        
        function setupCloseHandler(message) {
            var closeNode = message.domNode.querySelector('.close');
            closeNode.onclick = function() {
                hide(message);
            };
        }
        
        function repositionMessages(tab) {
            var messages = messageStack.filter(function(message) {
                return message.tab == tab;
            });
            
            messages.forEach(function(message, index) {
                showMessage(message, messageStack[index-1]);
            });
        }
        
        function show(text, action, tab) {
            if (!tab)
                return;
                
            var messages = messageStack.filter(function(message) {
                return message.tab == tab;
            });
            
            if (isAlreadyShowingMessage(messages, text))
                return;
                
            var message = {
                tab: tab,
                domNode: createMessageNode(text),
                action: action,
                text: text
            };
            
            setupMessageAction(message, action);
            setupCloseHandler(message);
            showMessage(message, messages[messages.length-1]);
            
            messageStack.push(message);
        }
        
        function hide(message) {
            if (!messageStack.length)
                return;    
        
            var domNode = message.domNode;
            domNode.style.display = 'none';
            domNode.style.opacity = 0;
            domNode.innerHTML = '';
            domNode.parentNode.removeChild(domNode);
            
            messageStack = messageStack.filter(function(msg) {
                return msg != message;
            });
            
            repositionMessages(message.tab);
        }
        
        plugin.on("load", function(){
            load();
        });
        
        plugin.freezePublicAPI({
            show: show,
            hide: hide,
            repositionMessages: repositionMessages
        });

        register(null, {
            "terminal.monitor.message_view": plugin
        });
    }
});
