var rest = require("restler");

var USERNAME = "c9";
var PASSWORD = "openme2";
var SALT = "Rzqwi1dEgMfM3ZWE7ex8ojTghBebEXIU9xvQVMJSeO7G69wF9JCSDvRxylM2Jhn";
var BASEURL = "https://api.mongolab.com/api/1/partners/c9"

var user = { name: "Ruben Daniels", email: "ruben@c9.io", username: "javruben" };
var username = "c9_" + user.username;

var vowel = /[aeiouAEIOU]$/;
var consonant = /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]$/;

function password(pattern, prefix) {
    if (!pattern) pattern = /\w/;
    if (!prefix) prefix = '';
    
    if (prefix.length >= 10)
        return prefix;
        
    pattern = prefix.match(consonant) ? vowel : consonant;
    
    var n = (Math.floor(Math.random() * 100) % 94) + 33;
    var char = String.fromCharCode(n).toLowerCase();
    
    if (!char.match(pattern))
        return password(pattern, prefix);
    return password(pattern, "" + prefix + char);
};

// @todo should we store the password somewhere in a safe place?

module.exports = function (vfs, options, register) {
    register(null, {
        // Create Account
        createAccount: function(callback) {
            var pw = password() + "1";
            
            rest.post(BASEURL + "/accounts", {
                username: USERNAME,
                password: PASSWORD,
                headers: {"Content-Type": "application/json"},
                data: JSON.stringify({
                    "name": username,
                    "adminUser": { 
                        "email"    : user.email,
                        "password" : pw
                    }
                })
            }).on('complete', function(data, resp) {
                if (resp.statusCode != 200 || data instanceof Error)
                    return callback(data);
                    
                data.password = pw;
                callback(null, data);
            });
        },
        
        // View Account
        // @todo
        
        // Delete Account
        deleteAccount: function(callback) {
            rest.del(BASEURL + "/accounts/" + username, {
                username: USERNAME,
                password: PASSWORD
            }).on('complete', function(data, resp) {
                if (resp.statusCode != 200 || data instanceof Error)
                    return callback(data);
                callback(null, true);
            });
        },
        
        // List Databases
        listDatabases: function(callback) {
            rest.get(BASEURL + "/accounts/" + username + "/databases", {
                username: USERNAME,
                password: PASSWORD
            }).on('complete', function(data, resp) {
                if (resp.statusCode != 200 || data instanceof Error)
                    return callback(data);
                
                data = data.map(function(db){ return db.name; });
                    
                callback(null, data);
            });
        },
        
        // Create Database
        createDatabase: function(options, callback) {
            rest.post(BASEURL + "/accounts/" + username + "/databases", {
                username: USERNAME,
                password: PASSWORD,
                headers: {"Content-Type": "application/json"},
                data: JSON.stringify({ 
                    "name"     : username + "_" + options.name,
                    "plan"     : options.plan || "sandbox",
                    "cloud"    : options.cloud,
                    "username" : options.username || "admin",
                    "password" : options.password || "admin"
                })
            }).on('complete', function(data, resp) {
                if (resp.statusCode != 200 || data instanceof Error)
                    return callback(data);
                callback(null, data);
            });
        },
        
        // View Database
        // @todo
        
        // Delete Database
        deleteDatabase: function(options, callback) {
            rest.del(BASEURL + "/accounts/" + username + "/databases/" + username + "_" + options.name, {
                username: USERNAME,
                password: PASSWORD
            }).on('complete', function(data, resp) {
                if (resp.statusCode != 200 || data instanceof Error)
                    return callback(data);
                callback(null, true);
            });
        },
        
        // Get Dashboard URL
        getDashboardUrl: function(callback) {
            var crypto = require('crypto');
            var timestamp = new Date().getTime();
            var token = crypto.createHash('sha1')
                .update(username + ":" + SALT + ":" + timestamp)
                .digest('hex');
                
            callback(null, "https://mongolab.com/login/partners/c9/users/" 
                + username + "?timestamp=" + timestamp 
                + "&token=" + token);
        }
    });
}