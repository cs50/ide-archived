/**
 * Sauce Connect plugin for Cloud9.
 *
 * @extends Plugin
 * @singleton
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "ui", "api", "info", "log", "proc"
    ];
    main.provides = ["preview.saucelabs.auth"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        var info = imports.info;
        var api = imports.api;
        var log = imports.log;
        var proc = imports.proc;
        
        var BASH = options.bashBin || "bash";
        var SERVER_URL = options.serverURL || "https://saucelabs.com";
        
        var account;
        
        function load() {
            account = info.getUser().saucelabs || options.account;
            
            info.on("change", function(e) {
                var oldAccount = account;
                account = e.user.saucelabs;
                if ((account && account.username) !== (oldAccount && oldAccount.username))
                    emit("change");
                if (account)
                    delete account.password; // don't store to profile.settings
            });
        }
        
        function isAccountAvailable() {
            return !!account;
        }
        
        function isCloud9Account() {
            return account && (account.isNew || (account.username.indexOf("c9sauce") > -1));
        }
        
        function getAccount(callback) {
            if (account)
                return callback(null, account);
            
            api.user.get("saucelabs_account", function(err, _account) {
                if (err) return callback(err);
                    
                try {
                    account = _account.username ? _account : JSON.parse(_account);
                } catch (e) {
                    return callback("Could not parse account from API: " + _account);
                }
                
                if (account.isNew)
                    log.logEvent("Created new Sauce Labs account");
                
                return callback(null, account);
            });
        }
        
        function login(username, password, callback) {
            // CORS fails here when doing it from the client,
            // so let's be pragmatic
            var passwordEscaped = password.replace(/'/g, "'\\''");
            var url = SERVER_URL + "/rest/v1/users/" + username; 
            proc.execFile(
                BASH,
                {
                    args: [
                        "-c",
                        "curl --user '" + username + ':' + passwordEscaped + "' " + url
                        + " || wget -qO- --user '" + username + "' --password '"
                        + passwordEscaped + "' " + url
                    ]
                },
                function(err, stdout, stderr) {
                    if (err) return callback(err);
                    
                    var response;
                    try {
                        response = JSON.parse(stdout);
                    } catch (e) {
                        return callback("Could not parse API response: " + stdout);
                    }
                    
                    if (response.error)
                        return callback(response.error);
                    
                    var result = {
                        username: response.id,
                        apikey: response.access_key,
                        email: response.email,
                        usertype: response.user_type,
                    };
                    
                    if (!result.apikey)
                        return callback("Could not get SauceLabs API key");
                    
                    account.username = result.username;
                    account.apikey = result.apikey;
                    delete account.password;
                    
                    api.user.post("saucelabs_account", { body: account },
                        function(err) {
                            callback(err, result);
                        }
                    );
                }
            );
        }
        
        function getServerURL() {
            return SERVER_URL;
        }
        
        plugin.on("load", function() {
            load();
        });
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * Test whether the user is currently authenticated with Cloud9,
             * *and* whether they have a Sauce Labs account. If this is not
             * true, a login screen may have to be shown and a new account
             * may have to be allocated for this user.
             * 
             * @return {Boolan}
             */
            isAccountAvailable: isAccountAvailable,
            
            /**
             * @param callback
             */
            getAccount: getAccount,
            
           /**
             * Returns whether this Sauce Labs account was created by Cloud9 or by 
             * the user (i.e. is he a (premium) Sauce Labs user)
             * @return {Boolean} isCloud9Account True if it was created by Cloud9
             */
            isCloud9Account: isCloud9Account,
            
            /**
             * 
             * Sign in with the given username and password,
             * and add it to the Cloud9 account of this user.
             * 
             * @param username
             * @param password
             * @param callback
             */
            login: login,
            
            getServerURL: getServerURL,
            
            _events: [
                /**
                 * Fired when the account information changes.
                 * 
                 * @event change
                 */
                "change"
            ]
        });
        
        register(null, { "preview.saucelabs.auth" : plugin });
    }
});