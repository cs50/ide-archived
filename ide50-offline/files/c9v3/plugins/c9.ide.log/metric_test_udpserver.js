// simple UDP server that logs everything it receives to the console
var dgram = require("dgram"); 
var netutil = require("netutil");
var udpPort = 4444;
netutil.findFreePort(20000, 40000, "localhost", function(err, port) {
    if (err)
        return console.error(err);
    
    udpPort = port;

    var server = dgram.createSocket("udp4");
    server.on("message", function (msg, rinfo) {
        console.log(msg.toString());
    });
    server.on("error", function(e) {
        console.error(e.message);
    });
    server.on("listening", function() {
        console.log("port:" + udpPort);
    });
    
    server.bind(udpPort);
});