/*global describe:false, it:false */

"use client";

require([
    "lib/architect/architect", 
    "lib/chai/chai", 
    "sinon",
    "./plugins/c9.ide.terminal.monitor/message_handler",
    "./plugins/c9.ide.terminal.monitor/message_matchers"
], function (architect, chai, sinon, MessageHandler, messageMatchers) {
    var expect = chai.expect;
    var c9 = {
        hostname: 'c9.io'
    };
    
    messageMatchers = messageMatchers(c9);
    var matchers = messageMatchers.matchers;
    var messages = messageMatchers.messages;
    
    describe("Message handler", function() {
        var messageHandler;
        var formatMessageSpy;
        var messageView;
        beforeEach(function() {
            messageView = { show: function() {} };
            messageHandler = new MessageHandler(matchers, messageView);
            formatMessageSpy = sinon.spy(messageView, "show");
        });
        it("catches generic (listening at) wrong IP", function() {
            messageHandler.handleMessage("Server listening at http://localhost:3000/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        it("catches generic (listening at) wrong port", function() {
            messageHandler.handleMessage("Server listening at http://0.0.0.0:8081/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        it("catches generic (listening at) wrong port / IP", function() {
            messageHandler.handleMessage("Server listening at http://127.0.0.1:8081/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        it("catches generic (listening at) running", function() {
            messageHandler.handleMessage("Server listening at http://0.0.0.0:8080/");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        it("catches generic (is listening at) wrong port", function() {
            messageHandler.handleMessage("Server is listening at http://localhost:3000/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        it("catches generic (is listening at) running", function() {
            messageHandler.handleMessage("Server is listening at http://0.0.0.0:8080/");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        it("catches generic (is running on) wrong port", function() {
            messageHandler.handleMessage("Server is running on http://localhost:3000/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        it("catches generic (is running on) running", function() {
            messageHandler.handleMessage("Server is running on http://0.0.0.0:8080/");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        it("catches ionic wrong port", function() {
            messageHandler.handleMessage("Running dev server: http://0.0.0.0:8081/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        it("catches ionic running", function() {
            messageHandler.handleMessage("Running dev server: http://0.0.0.0:8080/");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        it("catches ionic running with different $IP", function() {
            messageHandler.handleMessage("Running dev server: http://127.101.12.0:8080/");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        it("catches meteor wrong port", function() {
            messageHandler.handleMessage("App running at: http://localhost:3000/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        it("catches meteor running", function() {
            messageHandler.handleMessage("App running at: http://0.0.0.0:8080/");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        it("catches Webrick running", function() {
            messageHandler.handleMessage("mostafaeweda@demo-project\r\n\
                INFO  WEBrick::HTTPServer#start: pid=5462 port=8080");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        it("catches Webrick wrong port", function() {
            messageHandler.handleMessage("mostafaeweda@demo-project\r\n\
                INFO  WEBrick::HTTPServer#start: pid=5462 port=3000");
            expect(formatMessageSpy.calledWith(messages.rails.wrongPortIP)).to.equal(true);
        });
        it("catches rails/sinatra address in use error", function() {
            messageHandler.handleMessage("WARN  TCPServer Error: Address already in use - bind(2)");
            expect(formatMessageSpy.calledWith(messages.rails.wrongPortIP)).to.equal(true);
        });
        it("catches node address in use error", function() {
            messageHandler.handleMessage("events.js:48\n\
                    throw arguments[1]; // Unhandled 'error' event\n\
                    Error: listen EADDRINUSE\n\
                    at errnoException (net.js:670:11)\n\
                    at Array.0 (net.js:771:26)\n\
                    at EventEmitter._tickCallback (node.js:190:38)\n");
            expect(formatMessageSpy.calledWith(messages.generic.addressInUse)).to.equal(true);
        });
        it("catches generic port already in use error", function() {
            messageHandler.handleMessage("Error: That port is already in use\n");
            expect(formatMessageSpy.calledWith(messages.generic.addressInUse)).to.equal(true);
        });
        it("catches generic port already in use error (15454)", function() {
            messageHandler.handleMessage("Failed to open socket on port 15454\n");
            expect(formatMessageSpy.calledWith(messages.generic.debuggerPortInUse)).to.equal(true);
        });
        it("catches node permission error", function() {
            messageHandler.handleMessage("events.js:48\n\
                    throw arguments[1]; // Unhandled 'error' event\n\
                    Error: listen EACCESS\n\
                    at errnoException (net.js:670:11)\n\
                    at Array.0 (net.js:771:26)\n\
                    at EventEmitter._tickCallback (node.js:190:38)\n");
            expect(formatMessageSpy.calledWith(messages.generic.addressInUse)).to.equal(true);
        });
        
        it("catches django error", function () {
            messageHandler.handleMessage("Error: You don't have permission to access that port.\n");
            expect(formatMessageSpy.calledWith(messages.django.wrongPortIP)).to.equal(true);
        });
        
        it("catches grunt-serve running", function() {
            messageHandler.handleMessage("Server is running on port 8080...\n");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        
        it("catches grunt-serve wrong port", function() {
            messageHandler.handleMessage("Server is running on port 9000...\n");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        
        it("catches grunt-reload running", function() {
            messageHandler.handleMessage("Proxying http://0.0.0.0:8080/");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        
        it("catches jekyll wrong port", function() {
            messageHandler.handleMessage("Server address: http://0.0.0.0:4000/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        
        it("catches jekyll running", function() {
            messageHandler.handleMessage("Server address: http://0.0.0.0:8080/");
            expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
        });
        
        it("catches grunt-reload wrong port", function() {
            messageHandler.handleMessage("Proxying http://0.0.0.0:9999/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            messageHandler.handleMessage("Proxying http://localhost:12345/");
            expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
        });
        
        it("catch reload server not supported", function() {
            messageHandler.handleMessage("reload server running at http://localhost:35729\n");
            expect(formatMessageSpy.calledWith(messages.generic.noLiveReload)).to.equal(true);
            messageHandler.handleMessage("reload server running at http://0.0.0.0:9000\n");
            expect(formatMessageSpy.calledWith(messages.generic.noLiveReload)).to.equal(true);
        });
        
    });
        
    onload && onload();
    
});
