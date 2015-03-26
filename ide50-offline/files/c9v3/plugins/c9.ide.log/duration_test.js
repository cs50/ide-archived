/*global describe, it, before, beforeEach, afterEach, test */ 

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
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        {
            packagePath: "plugins/c9.ide.editors/editors",
            defaultEditor: "texteditor"
        },
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.editors/texteditor",
        "plugins/c9.ide.editors/timeview",
        "plugins/c9.ide.editors/imgview",
        {
            packagePath: "plugins/c9.vfs.client/vfs_client"
        },
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.fs/fs.cache.xml",
        {
            packagePath: "plugins/c9.ide.log/log"
        },
        "plugins/c9.ide.log/duration",
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
            consumes : ["apf", "ui", "Plugin"],
            provides : [
                "commands", "menus", "commands", "layout", "watcher", "proc",
                "save", "anims", "clipboard", "dialog.alert", "auth.bootstrap",
                "info", "dialog.error", "c9"
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
            consumes: ["log", "c9", "duration", "tabManager", "ui", "vfs"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var log = imports.log;
        var duration = imports.duration;
        var c9 = imports.c9;
        var tabs = imports.tabManager;
        
        var _ = require("lodash");

        c9.hasNetwork = true;
        c9.has = function() {
            return c9.hasNetwork;
        };

        expect.html.setConstructor(function(tab){
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        describe('duration', function() {

            describe("logStart(), logEnd()", function(){

                beforeEach(function(done) {
                    // allow 10 messages to be sent in a short timeframe so tests do not break on the wrong order of messages when they're being buffered
                    log.setMessageSendingWindowTime(1);
                    // clear in-memory duration storage so it doesn't influence the next test
                    duration.clearDurationStorage();
                    done();
                });
                
                it('Should record positive values', function(done) {
                    duration.once("logStart", onLogStart); 
                    
                    duration.logStart("someEvent");
                    
                    function onLogStart(e) {
                        setTimeout(function() {
                            duration.once("logStart", onLogStart2); 
                            
                            duration.logStart("someEvent");
                            
                            function onLogStart2(e) {
                                var storage = _.cloneDeep(duration.getDurationStorage().someEvent);
                                expect(storage.name).to.equal('someEvent');
                                var slots = storage.slots;
                                for (var i = 0; i < slots.length; i++) {
                                    expect(slots[i][0]).to.be.above(-1);
                                }
                                done();
                            }
                        }, 10);
                    }
                });
                
                it('Should record negative values', function(done) {
                    duration.once("logStart", onLogStart); 
                    duration.logStart("someEvent", "js");
                    
                    function onLogStart(e) {
                        duration.once("logEnd", onLogEnd); 
                        duration.logEnd("someEvent");
                        
                        function onLogEnd(e) {
                            setTimeout(function() {
                                duration.once("logStart", onLogStart2); 
                                duration.logStart("someEvent");
                                
                                function onLogStart2(e) {
                                    var storage = _.cloneDeep(duration.getDurationStorage().someEvent);
                                    expect(storage.name).to.equal('someEvent');
                                    var slots = storage.slots;
                                    var totalDurationOther = 0;
                                    for (var i = 0; i < slots.length; i++) {
                                        if (slots[i][1] != "js")
                                            totalDurationOther += slots[i][0];
                                    }
                                    expect(totalDurationOther).to.be.below(0);
                                    done();
                                }
                            }, 10);
                        }
                    }
                });
                
                it('Should add up total duration for an event\'s file types correctly', function(done) {
                    duration.once("logStart", onLogStart); 
                    duration.logStart("someEvent", "js");

                    function onLogStart(e) {
                        setTimeout(function() {
                            duration.once("logEnd", onLogEnd); 
                            duration.logEnd("someEvent");
    
                            function onLogEnd(e) {
                                setTimeout(function() {
                                    duration.once("logStart", onLogStart2); 
                                    duration.logStart("someEvent", "php");
                                
                                    function onLogStart2(e) {
                                        setTimeout(function() {
                                            duration.logEnd("someEvent");
                                            var storage = _.cloneDeep(duration.getDurationStorage().someEvent);
                                            expect(storage.name).to.equal('someEvent');
                                            var slots = storage.slots;
                                            var totalDurationPHP = 0;
                                            var totalDurationJS = 0;
                                            var totalDurationOther = 0;
                                            for (var i = 0; i < slots.length; i++) {
                                                if (slots[i][1] == "php")
                                                    totalDurationPHP += slots[i][0];
                                                else if (slots[i][1] == "js")
                                                    totalDurationJS += slots[i][0];
                                                else
                                                    totalDurationOther += slots[i][0];
                                            }
                                            expect(totalDurationOther).to.be.below(0);
                                            expect(storage.ftDur.js).to.equal(totalDurationJS);
                                            expect(storage.ftDur.php).to.equal(totalDurationPHP);
                                            done();
                                        }, 10);
                                    }
                                }, 10);
                            }
                        }, 10);
                    }
                });
            });
                
            describe("loggedIn, windowFocus", function(){

                beforeEach(function(done) {
                    c9.hasNetwork = true;
                    c9.emit("stateChange", { state: 1});
                    // make sure any stats are not already cleared before the test can complete
                    log.setIntervalWriteToDWH(60000);
                    // allow 10 messages to be sent in a short timeframe so tests do not break on the wrong order of messages when they're being buffered
                    log.setMessageSendingWindowTime(1);
                    // clear in-memory duration storage so it doesn't influence the next test
                    duration.clearDurationStorage();
                    done();
                });
                
                afterEach(function(done) {
                    // set all timers to a normal pace so they don't overload the 
                    // window if one test fails
                    log.setIntervalWriteToDWH(60000);
                    duration.setLoggingIntervalForEvent('loggedIn', 60000);
                    duration.setLoggingIntervalForEvent('windowFocus', 60000);
                    done();
                });
                
                it('should log loggedIn duration to internal storage immediately', function(done) {
                    duration.setLoggingIntervalForEvent('loggedIn', 5);
                    duration.on("logStart", onLogStart);

                    function onLogStart(e) {
                        if (e.name == "loggedIn") {
                            duration.off("logStart", onLogStart);
                            setTimeout(function() {
                                var storage = _.cloneDeep(duration.getDurationStorage().loggedIn);
                                expect(storage.name).to.equal('loggedIn');
                                expect(storage.totalTime).to.be.above(0);
                                expect(storage.ftDur.none).to.be.above(0);
                                expect(storage.slots.length).to.be.above(0);
                                done();
                            }, 20);
                        }
                    }
                });
    
                it('Should add up loggedIn duration types correctly', function(done) {
                    duration.setLoggingIntervalForEvent('loggedIn', 5);
                    duration.on("logStart", onLogStart);

                    function onLogStart(e) {
                        if (e.name == "loggedIn") {
                            duration.off("logStart", onLogStart);
                            setTimeout(function() {
                                var storage = _.cloneDeep(duration.getDurationStorage().loggedIn);
                                var slots = storage.slots;
                                var totalDurationLoggedIn = 0;
                                for (var i = 0; i < slots.length; i++) {
                                    totalDurationLoggedIn += slots[i][0];
                                }
                                expect(totalDurationLoggedIn).to.be.above(0);
                                expect(storage.ftDur.none).to.equal(totalDurationLoggedIn);
                                done();
                            }, 20);
                        }
                    }
                });
    
                it('should send loggedIn duration to the DWH from the start', function(done) {
                    duration.setLoggingIntervalForEvent('loggedIn', 5);
                    
                    setTimeout(function() {
                        log.setIntervalWriteToDWH(5);
                        log.on("loggedToDWH", onLogToDWH); 
                        function onLogToDWH(e) {
                            var message = e;
                            if (message.name == "loggedIn") {
                                log.off("loggedToDWH", onLogToDWH);
                                expect(message.source).to.equal("web");
                                expect(message.workspace_id).to.equal(2);
                                expect(message.c9_version).to.equal(undefined);
                                expect(message.type).to.equal("duration");
                                expect(message.uid).to.equal(1);
                                expect(message.name).to.equal("loggedIn");
                                expect(message.file_type).to.equal("none");
                                done();
                            }
                        }
                    }, 10);
                });
                
                it('should send correct loggedIn durations to the DWH', function(done) {
                    var i = 0; // counts how often logStart for loggedIn happened
                    var storage; // holds duration storage for loggedIn
                    duration.on("logStart", onLogStart);
                    duration.setLoggingIntervalForEvent('loggedIn', 5);
                    
                    function onLogStart(e) {
                        if (e.name == "loggedIn")
                            i++;
                        if (e.name == "loggedIn" && i > 1) {
                            // it already happened twice, so let's check the storage
                            duration.off("logStart", onLogStart);
                            storage = _.cloneDeep(duration.getDurationStorage().loggedIn);
                            log.setIntervalWriteToDWH(5);
                            log.once("loggedToDWH", onLogToDWH); 
                        }
                    }
                    
                    function onLogToDWH(e) {
                        var message = e;
                        if (message.name == "loggedIn") {
                            log.off("loggedToDWH", onLogToDWH);
                            var durationProcessed = 0;
                            var fileType = storage.slots[0][1];
                            expect(message.file_type).to.equal(fileType);
                            expect(message.start_time).to.equal(storage.startTime + durationProcessed);
                            var dur = storage.slots[0][0];
                            expect(message.duration).to.equal(dur);
                            durationProcessed += dur;
                            done();
                        }
                    }
                });

                it('should buffer specific duration events in localStorage on connection drop', function(done) {
                    duration.setLoggingIntervalForEvent('loggedIn', 5);
                    log.setIntervalWriteToDWH(10);
                    duration.on("logStart", onLogStart);

                    function onLogStart(e) {
                        if (e.name == "loggedIn") {
                            duration.off("logStart", onLogStart);
                            log.once("loggedToLocalStorage", onLogToLocalStorage);
                            // logging has started, now kill connection and wait for local storage event to occur
                            c9.hasNetwork = false;
                            c9.emit("stateChange", { state: 1});
                            log.setIntervalWriteToDWH(10);
                        }
                    }
                    
                    function onLogToLocalStorage(e) {
                        var storage = localStorage.getItem('logMessages');
                        var logMessages = JSON.parse(storage);
                        expect(logMessages).to.be.an('array');
                        
                        var expected1 = {
                            source: "web",
                            c9_version  : undefined,
                            type: "duration",
                            name: "loggedIn",
                            uid: 1,
                            workspace_id: 2,
                            file_type: "none"
                        };
                        expect(logMessages[0].source).to.equal(expected1.source);
                        expect(logMessages[0].c9_version).to.equal(expected1.c9_version);
                        expect(logMessages[0].type).to.equal(expected1.type);
                        expect(logMessages[0].name).to.equal(expected1.name);
                        expect(logMessages[0].uid).to.equal(expected1.uid);
                        expect(logMessages[0].workspace_id).to.equal(expected1.workspace_id);
                        expect(logMessages[0].file_type).to.equal(expected1.file_type);
                        expect(logMessages[0].duration).to.be.above(0);
                        expect(logMessages[0].start_time).to.be.above(0);
                        done();
                    }
                });
                
                it('should log windowFocus duration to internal storage immediately', function(done) {
                    duration.setLoggingIntervalForEvent('windowFocus', 5);
                    var myEvent = new CustomEvent("visibilitychange", {hidden: false});
                    document.dispatchEvent(myEvent);
                    duration.on("logStart", onLogStart);

                    function onLogStart(e) {
                        if (e.name == "windowFocus") {
                            duration.off("logStart", onLogStart);
                            setTimeout(function() {
                                var storage = _.cloneDeep(duration.getDurationStorage().windowFocus);
                                expect(storage.totalTime).to.be.above(0);
                                expect(storage.ftDur.none).to.be.above(0);
                                expect(storage.slots.length).to.be.above(0);
                                done();
                            }, 20);
                        }
                    }
                });
                
                it('should log windowFocus and unFocus duration', function(done) {
                    duration.setLoggingIntervalForEvent('windowFocus', 5);
                    var myEvent = new CustomEvent("visibilitychange", {hidden: false});
                    document.dispatchEvent(myEvent);
                    duration.on("logStart", onLogStart);

                    function onLogStart(e) {
                        if (e.name == "windowFocus") {
                            duration.off("logStart", onLogStart);
                            setTimeout(function() {
                                myEvent.hidden = true;
                                document.dispatchEvent(myEvent);
                                setTimeout(function() {
                                    myEvent.hidden = false;
                                    document.dispatchEvent(myEvent);
                                    setTimeout(function() {
                                        var storage = _.cloneDeep(duration.getDurationStorage().windowFocus);
                                        expect(storage.slots.length).to.be.above(1);
                                        var slots = storage.slots;
                                        var foundNegativeSlot = false;
                                        for (var i = 0; i < slots.length; i++) {
                                            if (slots[i][0] < 0)
                                                foundNegativeSlot = true;
                                        }
                                        expect(foundNegativeSlot).to.be.true;
                                        done();
                                    }, 10);
                                }, 10);
                            }, 10);
                        }
                    }
                });
    
                it('Should add up windowFocus duration types correctly', function(done) {
                    duration.setLoggingIntervalForEvent('windowFocus', 5);
                    var myEvent = new CustomEvent("visibilitychange", {hidden: false});
                    document.dispatchEvent(myEvent);
                    duration.on("logStart", onLogStart);

                    function onLogStart(e) {
                        if (e.name == "windowFocus") {
                            duration.off("logStart", onLogStart);
                            setTimeout(function() {
                                myEvent.hidden = true;
                                document.dispatchEvent(myEvent);
                                setTimeout(function() {
                                    myEvent.hidden = false;
                                    document.dispatchEvent(myEvent);
                                    setTimeout(function() {
                                        var storage = _.cloneDeep(duration.getDurationStorage().windowFocus);
                                        var totalDurationWindowFocus = 0;
                                        var foundNegativeSlot = false;
                                        var slots = storage.slots;
                                        for (var i = 0; i < slots.length; i++) {
                                            if (slots[i][0] < 0)
                                                foundNegativeSlot = true;
                                            else
                                                totalDurationWindowFocus += slots[i][0];
                                        }
                                        expect(foundNegativeSlot).to.be.true;
                                        expect(storage.ftDur.none).to.equal(totalDurationWindowFocus);
                                        done();
                                    }, 10);
                                }, 10);
                            }, 10);
                        }
                    }
                });
    
                it('should send windowFocus duration to the DWH from the start', function(done) {
                    duration.setLoggingIntervalForEvent('windowFocus', 5);
                    var myEvent = new CustomEvent("visibilitychange", {hidden: false});
                    document.dispatchEvent(myEvent);
                    
                    duration.on("logStart", onLogStart);

                    function onLogStart(e) {
                        if (e.name == "windowFocus") {
                            duration.off("logStart", onLogStart);
                            setTimeout(function() {
                                log.setIntervalWriteToDWH(5);
                                log.on("loggedToDWH", onLogToDWH); 
                                function onLogToDWH(e) {
                                    var message = e;
                                    if (message.name == "windowFocus") {
                                        log.off("loggedToDWH", onLogToDWH);
                                        expect(message.source).to.equal("web");
                                        expect(message.c9_version).to.equal(undefined);
                                        expect(message.type).to.equal("duration");
                                        expect(message.uid).to.equal(1);
                                        expect(message.workspace_id).to.equal(2);
                                        expect(message.name).to.equal("windowFocus");
                                        expect(message.file_type).to.equal("none");
                                        done();
                                    }
                                }
                            }, 10);
                        }
                    }
                });
    
                it('should send correct windowFocus durations to the DWH', function(done) {
                    var i = 0; // counts how often logStart for windowFocus happened
                    var storage; // holds duration storage for windowFocus
                    duration.on("logStart", onLogStart);
                    duration.setLoggingIntervalForEvent('windowFocus', 5);
                    
                    function onLogStart(e) {
                        if (e.name == "windowFocus")
                            i++;
                        if (e.name == "windowFocus" && i > 2) {
                            // it already happened twice, so let's check the storage
                            duration.off("logStart", onLogStart);
                            storage = _.cloneDeep(duration.getDurationStorage().windowFocus);
                            log.setIntervalWriteToDWH(5);
                            log.once("loggedToDWH", onLogToDWH); 
                        }
                    }
                    
                    var durationProcessed = 0;
                    function onLogToDWH(e) {
                        var message = e;
                        if (message.name == "windowFocus") {
                            log.off("loggedToDWH", onLogToDWH);
                            var fileType = storage.slots[0][1];
                            expect(message.file_type).to.equal(fileType);
                            expect(message.start_time).to.equal(storage.startTime + durationProcessed);
                            var dur = storage.slots[0][0];
                            expect(message.duration).to.equal(dur);
                            durationProcessed += dur;
                            done();
                        }
                    }
                });
            });
    
            describe("tabFocus, activity", function(){
                before(function(done) {
                    log.setIntervalWriteToDWH(60000);
                    tabs.on("ready", function(){
                        tabs.getPanes()[0].focus();
                        done();
                    });
                });

               beforeEach(function(done) {
                    c9.hasNetwork = true;
                    c9.emit("stateChange", { state: 1});
                    // make sure any stats are not already cleared before the test can complete
                    log.setIntervalWriteToDWH(60000);
                    // allow 10 messages to be sent in a short timeframe so tests do not break on the wrong order of messages when they're being buffered
                    log.setMessageSendingWindowTime(1);
                    // clear in-memory duration storage so it doesn't influence the next test
                    duration.clearDurationStorage();
                    // focus window so all tab focus events are logged
                    var myEvent = new CustomEvent("visibilitychange", {hidden: false});
                    document.dispatchEvent(myEvent);
                    done();
                });
                
                afterEach(function(done) {
                    // set all timers to a normal pace so they don't overload the 
                    // window if one test fails
                    log.setIntervalWriteToDWH(60000);
                    // close all tabs
                    var allTabs = tabs.getTabs();
                    allTabs.forEach(function(tab) {
                        tab.close();
                    });
                    done();
                });
                
                /**
                 * Used by a few tests below, simply open and switch some tabs for focus events
                 * @param callback Called when all switching/focusing is done
                 * @param callback.err null if everything went okay
                 */
                function switchSomeTabs(callback) {
                    var firstTab; // the first tab to be opened
                    tabs.on("focusSync", onFocusSyncTxt);
                    function onFocusSyncTxt(e) {
                        if (e.tab.path === "/file.txt") {
                            firstTab = e.tab;
                            // unregister the listener, so it doesn't run this again when another test switches tabs
                            tabs.off("focusSync", onFocusSyncTxt);
                            tabs.on("focusSync", onFocusSyncUntitled);
                            setTimeout(function() {
                                tabs.open({
                                    path: "/Untitled1",
                                    focus: true,
                                    value : ""
                                }, function(err, tab2){
                                    tabs.focusTab(tab2);
                                });
                            }, 10);
                        }
                    }
                    tabs.open({
                        path: "/file.txt",
                        focus: true
                    }, function(err, tab) {
                        tabs.focusTab(tab);
                    });
                    
                    function onFocusSyncUntitled(e) {
                        if (e.tab.path === "/Untitled1") {
                            // unregister the listener, so it doesn't run this again when another test switches tabs
                            tabs.off("focusSync", onFocusSyncUntitled);
                            // now focus another tab
                            tabs.once("focusSync", onFocusSyncFirstTab);
                            tabs.focusTab(firstTab);
                        }
                    }
                    
                    function onFocusSyncFirstTab(e) {
                        return callback(null);
                    }
                }

                it('should log tabFocus duration to internal storage immediately', function(done) {
                    var i = 0; // holds the count of tabFocus events ocurring
                    duration.on("logStart", onLogStart);
                    duration.setLoggingIntervalForEvent('tabFocus', 5);
                    
                    switchSomeTabs(function(err) {
                        if (err) return console.error(err);
                    });
                    
                    function onLogStart(e) {
                        if (e.name == "tabFocus")
                            i++;
                        if (e.name == "tabFocus" && i > 3 && e.lastFileType == "!none") {
                            // it already happened 4x, so let's check the storage
                            duration.off("logStart", onLogStart);
                            var storage = _.cloneDeep(duration.getDurationStorage().tabFocus);
                            expect(storage.name).to.equal('tabFocus');
                            expect(storage.totalTime).to.be.above(0);
                            expect(storage.ftDur.txt).to.be.above(0);
                            expect(storage.slots.length).to.be.above(0);
                            done();
                        }
                    }
                });

                it('should send tabFocus duration to the DWH from the start', function(done) {
                    switchSomeTabs(function(err) {
                        if (err) return console.error(err);
                        log.setIntervalWriteToDWH(6);
                        log.on("loggedToDWH", onLogToDWH); 
                        function onLogToDWH(e) {
                            var message = e;
                            if (message.name == "tabFocus") {
                                log.off("loggedToDWH", onLogToDWH);
                                expect(message.source).to.equal("web");
                                expect(message.workspace_id).to.equal(2);
                                expect(message.c9_version).to.equal(undefined);
                                expect(message.type).to.equal("duration");
                                expect(message.uid).to.equal(1);
                                expect(message.name).to.equal("tabFocus");
                                log.off("loggedToDWH", onLogToDWH);
                                done();
                            }
                        }
                    });
                });
                
                it('should send correct tabFocus durations to the DWH', function(done) {
                    switchSomeTabs(function(err) {
                        if (err) return console.error(err);
                        var storage = _.cloneDeep(duration.getDurationStorage().tabFocus);
                        log.setIntervalWriteToDWH(7);
                        log.on("loggedToDWH", onLogToDWH); 
                        function onLogToDWH(e) {
                            var message = e;
                            if (message.name == "tabFocus") {
                                log.off("loggedToDWH", onLogToDWH);
                                var durationProcessed = 0;
                                var dur = storage.slots[0][0];
                                expect(message.duration).to.equal(Math.abs(dur));
                                if (dur > 0) {
                                    var fileType = storage.slots[0][1];
                                    expect(message.file_type).to.equal(fileType);
                                }
                                expect(message.start_time).to.equal(storage.startTime + durationProcessed);
                                durationProcessed += Math.abs(dur);
                                log.off("loggedToDWH", onLogToDWH);
                                done();
                            }
                        }
                    });
                });
            });

        });
        
        onload && onload();
    }

});