var fs = require("fs");
var http = require("http");

module.exports = function(vfs, options, register) {
    register(
        null,
        {
            benchmark: function(ping, callback) {
                var result = 0;
                var end = Date.now() + 700;
                while (Date.now() < end) {
                    result++;
                }
                fs.writeFile("/var/lib/c9/res", result + " " + ping, function(err) {
                    if (err) console.error(err);
                    callback(null, result);
                });
            },
            
            getCPULimit: function(callback) {
                if (typeof callback !== "function")
                    throw new Error("Bad callback specified for getCPULimit():" + JSON.stringify(callback) + " " + callback.constructor);
                
                fs.readFile("/var/lib/c9/limits", function(err, result) {
                    if (err) return callback(null, false); // ignore; no limit
                    
                    var fields = result.toString().split(" ");

                    callback(null, parseInt(fields[0], 10) !== parseInt(fields[1], 10));
                });
            },
            
            getContainerStats: function(callback) {
                var req = http.get(
                    "http://172.17.0.1:9999/stats",
                    function(res) {
                        var response = "";
                        res.on("data", function(chunk) {
                            response += chunk;
                        });
                        res.on("end", function() {
                            done(null, response);
                        });
                    }
                );
                
                req.on("error", done);
                req.on("timeout", done);
                
                var isDone;
                function done(err, response) {
                    if (isDone) return;
                    isDone = true;
                    
                    if (err)
                        return callback(err);
                    
                    var result;
                    try {
                        result = JSON.parse(response);
                    }
                    catch (e) {
                        return callback(new Error("Couldn't parse response for getContainerStats"));
                    }
                    callback(null, result);
                }
            }
        }
    );
};