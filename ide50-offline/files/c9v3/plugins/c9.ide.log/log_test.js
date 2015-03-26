/*global describe, it, before, test, afterEach, beforeEach */ 

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root", "sinon"], 
  function (architect, chai, baseProc, sinon) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.core/util",
        "plugins/c9.core/http-xhr",
        {
            packagePath: "plugins/c9.core/settings",
            settings: "default",
            testing: true
        },
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/anims",
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        {
            packagePath: "plugins/c9.ide.panels/panels",
            staticPrefix: "plugins/c9.ide.layout.classic",
            defaultActiveLeft: "test1",
            defaultActiveRight: "test3"
        },
        "plugins/c9.ide.panels/area",
        "plugins/c9.ide.panels/panel",
        {
            packagePath: "plugins/c9.ide.log/log",
            testing: true
        },
        {
            packagePath: "plugins/c9.ide.analytics/analytics",
            secret: "test",
            flushAt: 1,
            integrations: {},
            tdWriteKey: "test",
            tdDb: "test_db"
        },
        
        // Mock plugins
        {
            consumes: ["apf", "ui", "Plugin"],
            provides: [
                "proc", "info", "c9", "commands", "menus", "commands", "layout", 
                "fs", "tabManager", 
            ],
            setup: expect.html.mocked
        },
        {
            consumes: [],
            provides: [
                "api"
            ],
            setup: function(options, imports, register) {
                register(null, {
                    api: {
                        stats: {
                            post: sinon.stub().callsArgWith(2, null, "testing")
                        }
                    }
                });
            }
        },
        {
            consumes: ["log", "c9", "c9.analytics"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        
        var log = imports.log;
        var c9 = imports.c9;
        
        c9.hasNetwork = true;
        c9.has = function() {
            return c9.hasNetwork;
        };
        
        describe('log', function() {
            
            describe('metrics', function() {
                
                beforeEach(function(done) {
                    log.setTestMode(true);
                    log.setSource("newclient");
                    // clear in-memory duration storage so it doesn't influence the next test
                    localStorage.clear();
                    // enable connection
                    c9.hasNetwork = true;
                    c9.emit("stateChange", { state: 1});
                    // make sure any stats are not already cleared before the test can complete
                    log.setIntervalWriteToDWH(60000);
                    log.setMessageSendingWindowTime(1000);
                    done();
                });
                
                it('should produce errors about missing/wrong metric parameters', function(done) {
                    // UID not a number
                    log.logMetric("testType","testEvent", "NaN", {}, function(err, result) {
                        expect(err).to.be.a('string');
                        // params not an object array
                        log.logMetric("testType","testEvent", 1, [], function(err, result) {
                            expect(err).to.be.a('string');
                            done();
                        });
                    });
                });
    
                it('should send correct metric to DWH', function(done) {
                    log.on("loggedToDWH", onLogToDWH); 
    
                    log.logMetric("testType", "testMetric", 1, {}, function(err, result) {
                        expect(err).to.be.null;
                    });
                    
                    function onLogToDWH(e) {
                        try {
                            var message = e;
                            if (message.name == "testMetric") {
                                log.off("loggedToDWH", onLogToDWH);
                                var expected = {
                                    source: "newclient",
                                    c9_version  : undefined,
                                    type: "testType",
                                    name: "testMetric",
                                    uid: 1,
                                    params: {},
                                };
                                expect(message.source).to.equal(expected.source);
                                expect(message.c9_version).to.equal(expected.c9_version);
                                expect(message.type).to.equal(expected.type);
                                expect(message.name).to.equal(expected.name);
                                expect(message.uid).to.equal(expected.uid);
                                expect(message.params).to.deep.equal(expected.params);
                                done();
                            }
                        }
                        catch (e) {
                            expect(e).to.be.null;
                            console.error(e);
                        }
                    }
                });
                
                it('should buffer a metric in localStorage on connection drop', function(done) {
                    log.once("loggedToLocalStorage", onLogToLocalStorage);
                    // now kill connection and wait for local storage event to occur
                    c9.hasNetwork = false;
                    c9.emit("stateChange", { state: 1});
                    
                    log.logMetric("testType", "testMetric", 1, {}, function(err, result) {
                        expect(err).to.be.null;
                    });
                    
                    function onLogToLocalStorage() {
                        var storage = localStorage.getItem('logMessages');
                        var logMessages = JSON.parse(storage);
                        expect(logMessages).to.be.an('array');
                        var expected = {
                            source: "newclient",
                            c9_version  : undefined,
                            type: "testType",
                            name: "testMetric",
                            uid: 1,
                            params: {},
                        };
                        expect(logMessages[0].source).to.equal(expected.source);
                        expect(logMessages[0].c9_version).to.equal(expected.c9_version);
                        expect(logMessages[0].type).to.equal(expected.type);
                        expect(logMessages[0].name).to.equal(expected.name);
                        expect(logMessages[0].uid).to.equal(expected.uid);
                        expect(logMessages[0].params).to.deep.equal(expected.params);
                        
                        done();
                    }
                });

                it('should send max 10 messages every 1000 milliseconds', function(done) {
                    log.setMessageSendingWindowTime(200);
                    log.once("bufferedMessages", onBufferedMessages); 
                    
                    // 1) send 11 messages
                    var devNull = function(err, result) {};
                    for (var i = 0; i < 11; i++) {
                        log.logMessage({name: "testMessage", id: i}, devNull);
                    }
                    
                    // 2) test if only 10 messages are sent initially
                    function onBufferedMessages(messageBuffer) {
                        // set a timer
                        this.bufferedMessages = Date.now();
                        // start checking for the rest of the messages
                        log.once("loggedToDWH", onLogToDWH); 
                    }

                    // 3) test if the rest is sent after 100 milliseconds or so
                    function onLogToDWH(message) {
                        var timeElapsed = Date.now() - this.bufferedMessages;
                        expect(timeElapsed).to.be.above(100); 
                        done();
                    }
                });
                
                it('should produce errors about missing/wrong event parameters', function(done) {
                    // UID not a number
                    log.logEvent('testEvent', "NaN", [], function(err, result) {
                        expect(err).to.be.a('string');
                        // params not an object array
                        log.logEvent('testEvent', 1, "not_an_array", function(err, result) {
                            expect(err).to.be.a('string');
                            done();
                        });
                    });
                });
    
                it('should send correct event to DWH', function(done) {
                    log.on("loggedToDWH", onLogToDWH); 
    
                    log.logEvent('testEvent', 1, {}, function(err, result) {
                        expect(err).to.be.null;
                    });
                    
                    function onLogToDWH(e) {
                        try {
                            var message = e;
                            if (message.name == "testEvent") {
                                log.off("loggedToDWH", onLogToDWH);
                                var expected = {
                                    source: "newclient",
                                    c9_version  : undefined,
                                    type: "event",
                                    name: "testEvent",
                                    uid: 1,
                                    params: {},
                                };
                                expect(message.source).to.equal(expected.source);
                                expect(message.c9_version).to.equal(expected.c9_version);
                                expect(message.type).to.equal(expected.type);
                                expect(message.name).to.equal(expected.name);
                                expect(message.uid).to.equal(expected.uid);
                                expect(message.params).to.deep.equal(expected.params);
                                done();
                            }
                        }
                        catch (e) {
                            expect(e).to.be.null;
                            console.error(e);
                        }
                    }
                });
    
                it('should send correct source (e.g. "desktop") to DWH', function(done) {
                    var source = "otherClient";
                    log.setSource(source);
                    log.once("loggedToDWH", onLogToDWH);
    
                    log.logMetric("testType", "testMetric", 1, {}, function(err, result) {
                        expect(err).to.be.null;
                    });
                    
                    function onLogToDWH(e) {
                        var message = e;
                        if (message.name == "testMetric") {
                            log.off("loggedToDWH", onLogToDWH);
                            expect(message.source).to.equal(source);
        
                            // now try with an event instead of a metric
                            log.once("loggedToDWH", onLogToDWH2);
                            log.logEvent('testEvent', 1, {}, function(err, result) {
                                expect(err).to.be.null;
                            });
                        }

                        function onLogToDWH2(e) {
                            var message = e;
                            if (message.name == "testEvent") {
                                log.off("loggedToDWH", onLogToDWH2);
                                expect(message.source).to.equal(source);
                                done();
                            }
                        }
                    }
                });
                
            });
            
            describe("offline", function() {

                beforeEach(function(done) {
                    log.setTestMode(true);
                    log.setSource("newclient");
                    // clear in-memory duration storage so it doesn't influence the next test
                    localStorage.clear();
                    // enable connection
                    c9.hasNetwork = true;
                    c9.emit("stateChange", { state: 1});
                    // make sure any stats are not already cleared before the test can complete
                    log.setIntervalWriteToDWH(60000);
                    log.setMessageSendingWindowTime(1000);
                    done();
                });
                
                it('should buffer an event in localStorage on connection drop', function(done) {
                    log.once("loggedToLocalStorage", onLogToLocalStorage);
                    // now kill connection and wait for local storage event to occur
                    c9.hasNetwork = false;
                    c9.emit("stateChange", { state: 1});
                    
                    log.logEvent('testEvent', 1, {}, function(err, result) {
                        expect(err).to.be.null;
                    });
                    
                    function onLogToLocalStorage() {
                        var storage = localStorage.getItem('logMessages');
                        var logMessages = JSON.parse(storage);
                        expect(logMessages).to.be.an('array');
                        var expected = {
                            source: "newclient",
                            c9_version  : undefined,
                            type: "event",
                            name: "testEvent",
                            uid: 1,
                            params: {},
                        };
                        expect(logMessages[0].source).to.equal(expected.source);
                        expect(logMessages[0].c9_version).to.equal(expected.c9_version);
                        expect(logMessages[0].type).to.equal(expected.type);
                        expect(logMessages[0].name).to.equal(expected.name);
                        expect(logMessages[0].uid).to.equal(expected.uid);
                        expect(logMessages[0].params).to.deep.equal(expected.params);
                        
                        done();
                    }
                });
    
                it('should send stats in localStorage after reconnect', function(done) {
                    log.once("loggedToDWH", onLogToDWH); 
                    log.once("loggedToLocalStorage", onLogToLocalStorage); 
                    // now kill connection and wait for local storage event to occur
                    c9.hasNetwork = false;
                    c9.emit("stateChange", { state: 1});
                    
                    log.logEvent('testEvent', 1, {}, function(err, result) {
                        expect(err).to.be.null;
                        log.logEvent('testEvent', 1, {}, function(err, result) {
                            expect(err).to.be.null;
                        });
                    });
                    
                    function onLogToLocalStorage(e) {
                        try {
                            var storage = localStorage.getItem('logMessages');
                            var logMessages = JSON.parse(storage);
                            expect(logMessages).to.be.an('array');
                            
                            // now restore connection
                            c9.hasNetwork = true;
                            c9.emit("stateChange", { state: 1});
                        } 
                        catch (e) {
                            expect(e).to.be.null;
                            console.error(e);
                        }
                    }
    
                    function onLogToDWH(e) {
                        if (e.name == "testEvent") {
                            log.off("loggedToDWH", onLogToDWH);
                            try {
                                var s = localStorage.getItem('logMessages');
                                var l = JSON.parse(s);
                                expect(l).to.be.an('array');
                                expect(l.length).to.equal(0);
                                done();
                            } 
                            catch (e) {
                                expect(e).to.be.null;
                                console.error(e);
                            }
                        }
                    }
                });
                
                it('should keep localStorage size pre-emptively in check after disconnect', function(done) {
                    var maxSize = 0.2;
                    log.setMaxLocalStorageSize(maxSize);
                    
                    log.on("loggedToLocalStorage", onLogToLocalStorage); 
                    c9.hasNetwork = false;
                    c9.emit("stateChange", { state: 1});
                    
                    function onLogToLocalStorage(e) {
                        var message = e[0];
                        if (message.name == "testEvent3") {
                            log.off("loggedToLocalStorage", onLogToLocalStorage);
                            var lsSize = JSON.stringify(localStorage).length / 1024;
                            expect(lsSize).to.be.below(maxSize);
                            done();
                        }
                    }
                    
                    log.logEvent('testEvent1', 1, {}, function(err, result) {
                        log.logEvent('testEvent2', 1, {}, function(err, result) {
                            log.logEvent('testEvent3', 1, {}, null);
                        });
                    });
                });
                
                it('should trim localStorage from the beginning on QUOTA_EXCEEDED_ERR after disconnect', function(done) {
                    var maxSize = 4096;
                    log.setMaxLocalStorageSize(maxSize);
                    localStorage.clear();
                    
                    var fillStorage = [];
                    // browser localstorage can take Math.ceil(2.50*1024*1024/2) but the mock we use is smaller
                    for (var i = 0; i < (10000 - 5); i++) {
                        fillStorage.push("x");  // each JS character is 2 bytes
                    }
                    try {
                        localStorage.setItem("logMessages", JSON.stringify(fillStorage));
                    } catch (error) {
                        // test should fail if localStorage can't be filled with 2.5MB
                        expect(error).to.be.null;
                    }
                    
                    c9.hasNetwork = false;
                    c9.emit("stateChange", { state: 1});
                    
                    log.once("trimmedLocalStorageSize", onTrimmed);
                    function onTrimmed(e) {
                        log.once("loggedToLocalStorage", onLoggedToLocalStorage);
                        function onLoggedToLocalStorage(e) {
                            var currLogStorage = localStorage.getItem('logMessages') || "";
                            var arr = [];
                            if (currLogStorage !== "") {
                                arr = JSON.parse(currLogStorage);
                            }
                            var lastItem = arr.pop();
                            expect(lastItem.name).to.equal("testEvent1");
                            localStorage.clear();
                            done();
                        }
                    }
                    
                    // now send the event and watch the exception be caught and subsequently localStorage trimmed from the beginning (not the end)
                    log.logEvent('testEvent1', 1, {}, function(err, result) {
                        expect(err).to.be.null;
                    });
                });
            });
        });
        
        onload && onload();
    }

});