define(function(require, exports, module) {
    main.consumes = ["Plugin", "net", "proc", "c9"];
    main.provides = ["debugger.socket"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var net = imports.net;
        var c9 = imports.c9;
        var proc = imports.proc;
        var nodeBin = Array.isArray(options.nodeBin)
            ? options.nodeBin[0]
            : options.nodeBin || "node";

        var DISCONNECTED = 0;
        var CONNECTED = 1;
        var CONNECTING = 2;
        
        var counter = 0;
        
        function Socket(port, proxySource, reconnect) {
            var socket = new Plugin();
            var emit = socket.getEmitter();
            var state, stream, connected, away;
            
            socket.__defineGetter__("state", function(){ return state; });
            
            c9.on("connect", function(){
                if (away) {
                    reconnect = true;
                    connect();
                }
            }, socket);
            c9.on("away", function(){
                if (!away) {
                    away = true;
                    state = "away";
                    emit("away");
                }
            }, socket);
            c9.on("back", function(){
                if (away) {
                    connectToPort(function(err) {
                        if (err) {
                            if (err.code == "ECONNREFUSED") {
                                state = null;
                                emit("end");
                                connect(true);
                            }
                            else
                                emit("err", err);
                            return;       
                        }
                    });
                }
            }, socket);
            c9.on("disconnect", function(){
                if (!away) {
                    away = true;
                    state = "away";
                    emit("away")
                }
            }, socket);
            
            function connect(force) {
                if (state == "connected" || state == "connecting") 
                    return;
                
                connected = CONNECTING;
                state = "connecting";
                
                if (reconnect && !force) {
                    connectToPort(function(err) {
                        if (!err) return;
                        
                        state = null;
                        
                        if (err.code == "ECONNREFUSED") {
                            emit("end");
                            connect(true);
                        }
                        else
                            return emit("err", err);
                    });
                }
                else {
                    proc.spawn(nodeBin, {
                        args: ["-e", proxySource]
                    }, function(err, process) {
                        if (err)
                            return emit("error", err);
                        
                        process.stderr.on("data", function(data) {
                            console.log("[netproxy]", data);
                        });
                        
                        process.stdout.on("data", function(data) {
                            if (data.match(/ß/))
                                connectToPort();
                            else
                                console.log("[netproxy] unexpected data", data);
                        });

                        process.on("exit", function(){
                            connected = DISCONNECTED;
                            state = "disconnected";
                        });
                        
                        // Make sure the process keeps running
                        process.unref();
                    });
                }
            }
            
            function connectToPort(callback) {
                net.connect(port + 1, {}, function(err, s) {
                    if (err)
                        return callback ? callback(err) : emit("error", err);
                    
                    stream = s;
                    stream.on("data", function(data) {
                        emit("data", data);
                    });
                    // Don't call end because session will remain in between disconnects
                    // stream.on("end", function(err) {
                    //     emit("end", err);
                    // });
                    stream.on("error", function(err) {
                        emit("error", err);
                    });
                    
                    if (reconnect)
                        emit("data", "Content-Length:0\r\n\r\n");
                    
                    connected = CONNECTED;
                    
                    state = "connected";
                    emit("connect");
                    
                    if (away) {
                        if (emit("beforeBack") !== false)
                            enable();
                    }
                    
                    callback && callback();
                });
            }
        
            function close(err) {
                stream && stream.end();
                if (state) {
                    state = null;
                    connected = DISCONNECTED;
                    emit("end", err);
                }
            }
        
            function send(msg) {
                stream && stream.write(msg, "utf8");
            }
            
            function enable(){
                away = false;
                state = "connected";
                emit("back");
            }
        
            socket.freezePublicAPI({
                /**
                 * 
                 */
                DISCONNECTED: DISCONNECTED,
                /**
                 * 
                 */
                CONNECTED: CONNECTED,
                /**
                 * 
                 */
                CONNECTING: CONNECTING,
                
                // Backward compatibility
                addEventListener: socket.on,
                removeListener: socket.off,
                setMinReceiveSize: function(){},
                
                /**
                 * 
                 */
                connect: connect,
                
                /**
                 * 
                 */
                enable: enable,
                
                /**
                 * 
                 */
                close: close,
                
                /**
                 * 
                 */
                send: send
            });
            
            socket.load("socket" + counter++);
            
            return socket;
        }
        
        register("", {
            "debugger.socket": Socket
        });
    }
});