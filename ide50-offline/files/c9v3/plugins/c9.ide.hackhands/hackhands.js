/**
 * This is an example of an almost minimal implementation of a plugin.
 * Check out [the source](source/template_minimal.html)
 *
 * @class Template
 * @extends Plugin
 * @singleton
 */
define(function(require, exports, module) {
    "use strict";
 
    main.consumes = [
        "c9", "Panel", "ui", "Menu", "MenuItem", "info", "layout", "api"
    ];
    main.provides = ["HackHands"];
    return main;
 
    function main(options, imports, register) {
        var Panel = imports.Panel;
 
        var ui = imports.ui;
        var c9 = imports.c9;
        var Info = imports.info;
        var layout = imports.layout;
        var api = imports.api;
        var markup = require("text!./hackhandsUI.xml");


        // Find urls paths for this running workspace + oauth on this server
        var workspacePath = window.location.origin+ window.location.pathname;
        var oauthEndpoint = window.location.origin.replace('ide.','')+"/auth/hackhands";
        var completePath = oauthEndpoint+'?r='+encodeURIComponent(workspacePath+'?hh=0');

        // Main trigger to enable the HH plugin by default
        var HH_LIVE_DEPLOY = false;

        // Runtime enviroment
        var ENV = 'production';

        if (c9.location.indexOf("hh_env=dev") > -1) 
            ENV = 'dev';
        
        if (c9.location.indexOf("hh_env=stage") > -1) 
            ENV = 'stage';

        // Possible hackhands endpoints
        var hh_endpoints = {
            "dev": 'http://hackhands.dev/mini/',
            "stage": 'https://cloud9dev.hackhands.com/mini/',
            "production": 'https://cloud9.hackhands.com/mini/',
        }

        // Initial state that HH plugin should be loaded
        var initialState = {
            "hh_endpoint": hh_endpoints[ENV]+'?utm_source=partner&utm_medium=cloud9',
            "ui.widget": completePath,
        };


        // Helper - Connect to iframe
        var hhConnect = function(userConfig){

            // If false or invalid window, return a dummy object (So it wont break apps)
            if (!userConfig.target)
            {
                //console.info('[hhConnect] No target window found!');
                return { on: function(){}, emit: function(){}, call: function(){}, bind: function(){} }
            }

            // Settings for this instance
            var config = {
                target: userConfig.target,
                cbReady: userConfig.onReady || function(){},
                namespace: userConfig.namespace || 'HH',
                permission: userConfig.permission || '*',
                instance: Math.random().toString(36).substr(2, 9),
                messageID: 0
            }

            // Will store all the callbacks for this instance
            var cbs = {
                event: {},
                method: {},
                message: {},
            }

            // Store this obj
            var obj = {}

            // HELPER: Generate a new messageID for communications
            var nextMessageID = function()
            {
                return config.instance+'-'+(config.messageID+++1);
            }

            // Helper: Send the message using an RPC fashion
            var sendMessage = function(name, data, id) {
                //console.log('sendMessage', [name, data, id])
                config.target.postMessage({
                    HH:true,
                    namespace: config.namespace, 
                    id: id || nextMessageID(), 
                    name: name, 
                    data: data
                }, config.permission);
            }

            // Incoming messages handler
            window.addEventListener("message", function(event){

                /*
                // Check origin policy
                if (event.origin !== '*' && event.origin !== 'null' && event.origin !== config.permission)
                    return console.warn('[hhConnect] Post Forbiden: ' + event.origin + ' != ' + config.permission);
                */

                var request = event.data;

                if (request.namespace !== config.namespace)
                    return;

                if (request.name == '__ready')
                {
                    if (request.data == 'ping!')
                        sendMessage('__ready', 'pong!')

                    config.cbReady();
                    return;
                }

                if (cbs.method[request.name])
                    cbs.method[request.name]( request.data, function(error, data){
                        sendMessage('_callback_'+request.name, {error: error, data: data}, request.id)
                    })

                // Any METHOD callback for this ID? Call it and delete it
                if (cbs.message[request.id])
                {
                    cbs.message[request.id](request.data.error, request.data.data)
                    delete cbs.message[request.id]
                }

                // Any EVENT with this name?
                if (cbs.event[request.name])
                    cbs.event[request.name](request.data);

                // Any catch-all EVENT? also send there
                if (cbs.event['*'] && request.name.indexOf('__event__') > -1)
                    cbs.event['*'](request.name.substring(9), request.data);

            }, false);


            setTimeout(function() {
                sendMessage('__ready', 'ping!')
            }, 0);

            return {
                // ########  EVENTS  ########
                on: function(eventName, eventCB){
                    cbs.event['__event__'+eventName] = eventCB
                },
                emit: function(eventName, eventData){
                    sendMessage('__event__'+eventName, eventData)
                },
                // ########  METHODS  ########
                bind: function(methodName, methodFunction){
                    cbs.method['_method_'+methodName] = methodFunction
                },      
                call: function(methodName, methodParams, methodCB){

                    var messageID = nextMessageID();

                    // Save this callback to call when this ID returns
                    if (methodCB)
                        cbs.message[messageID] = methodCB;

                    sendMessage('_method_'+methodName, methodParams, messageID);
                }
            }

        }

        // Helper - Set enabled or disabled state
        var deployControl = function(){

            // Force ENABLE plugin if hackhands=1
            if (c9.location.indexOf("hackhands=1") > -1)
                return true;

            // Force DISABLE plugin if hh=0 (HH Experts should NEVER see the plugin)
            if (c9.location.indexOf("hh=0") > -1)
                return false;

            // If we are not live, dont show the plugin
            if (!HH_LIVE_DEPLOY)
                return false;

            // Initial release deploy strategy: 
            // - Target ODD users only.
            // - node and html5 workspaces only.
            var workspaceType = Info.getWorkspace().contents;
            var userIDType = ( Info.getUser().id & 1 ) ? "odd" : "even";
            if (userIDType == 'odd' && (workspaceType == 'node' || workspaceType == 'html5'))
                return true;

            return false
        }

        // Helper - Save HH data on C9
        var setKey = function(uid, email, token, callback){
            api.user.post("hackhands_account", { 
                body: {
                    token: token,
                    email: email,
                    uid: uid
                }
            },
                function(err, result) {
                    callback(err, result);
                }
            );

        }

        // Helper - Hide loading and show iframe
        var showPlugin = function(){
            document.getElementById('HH_APP').style.display = 'block';
            document.getElementById('HH_LOADING').style.display = 'none';            
        }

        // Are we enabled?
        var ENABLED = deployControl();

        var plugin = new Panel("HackHands", main.consumes, {
            index    : 105,
            width    : 350,
            caption  : "Live coding Help!",
            minWidth : 350,
            where    : "right",
            elementName: "winOutline",
        });


        var loaded = false;
        plugin.on("load", function(){
            if (loaded) { return; }
            loaded = true;

            if (!ENABLED) { 
                plugin.hide();
                plugin.disable();
                return; 
            }
        });
 

        plugin.on("show", function(){});
 
        var initialized = false;
        plugin.on("draw", function(options) {

            // Prevent multiple initializations
            if (initialized) { return; }
            initialized = true;
            
            // Create UI elements
            ui.insertMarkup(options.aml, markup, plugin);

            // Load hackhands inside iframe
            document.getElementById("HH_APP").src = initialState.hh_endpoint;

            
            // - - - HackHands Integration - - - 
            var HH_Loaded = false;
            var HH = hhConnect({ target: document.getElementById("HH_APP").contentWindow });

            // Wait for ready state
            HH.on('state.ready', function(params){

                HH_Loaded = true;
                //console.log('HackHands Plugin is Ready');

                // Watch out for Theme changes
                layout.on("eachTheme", function(e){
                    initialState['ui.theme'] = layout.theme;
                    HH.call('ui.theme', layout.theme);
                });


                // Have we already some HH user saved on C9?
                api.user.get("hackhands_account", function(hh_error, hh_user){

                    // To simulate new user uncomment this line
                    //hh_user = {}

                    function prepareLoginState()
                    {
                        if (initialState["auth.signupExpress"])
                            delete initialState["auth.signupExpress"];

                        if (initialState["auth.logout"])
                            delete initialState["auth.logout"];

                        if (initialState["auth.loginExpress"])
                            delete initialState["auth.loginExpress"];     

                        // We dont have anything, lets create a new account on HH
                        if (hh_user.token == undefined) {
                            var c9_user = Info.getUser();
                            //c9_user.email = Math.random().toString(36).slice(-8)+'-'+c9_user.email
                            initialState["auth.signupExpress"] = { email: c9_user.email, name: c9_user.fullname };
                            return;
                        }

                        // If we have a logout flag, we don't do anything.
                        if (hh_user.token == '_LOGOUT_')
                        {
                            initialState["auth.logout"] = true;
                            return;
                        }

                        // We Have a token, lets use it to LOGIN
                        if (hh_user.token != '') {
                            initialState["auth.loginExpress"] = hh_user.token;
                            return;
                        }
                    }

                    prepareLoginState();
                    HH.call('init.state', initialState);
                });

            })

            // After the initial state has been set, show the plugin
            HH.on('state.initialState', function(){
                setTimeout(showPlugin, 1000);
            })

            // After successful signup save the hh api_key in c9
            HH.on('signup.success', function(logedUserData){
                //alert('c9: signup.success '+logedUserData.id+ ' - '+logedUserData.email+ ' - '+logedUserData.api_key)
                setKey(logedUserData.id, logedUserData.email, logedUserData.api_key, function(){})
            })

            // If error on signup set the logout (No more auto signup)
            HH.on('signup.error', function(){
                //alert('c9: signup.error')
                setKey(0, 'logout@example.com', '_LOGOUT_', function(){})
            })

            // After successful login save the hh api_key in c9
            HH.on('login.success', function(logedUserData){
                //alert('c9: login.success '+logedUserData.id+ ' - '+logedUserData.email+ ' - '+logedUserData.api_key)
                setKey(logedUserData.id, logedUserData.email, logedUserData.api_key, function(){})                
            })

            // If error on logout set the logout flag (No more auto login)
            HH.on('login.error', function(){
                //alert('c9: login.error ')
                setKey(0, 'logout@example.com', '_LOGOUT_', function(){})
            })

            // After successful logout remove the hh api_key from c9
            HH.on('logout.success', function(){
                //alert('logout.success');
                setKey(0, 'nouser@example.com', '_LOGOUT_', function(){})
            })


            // Force status update
            if (HH_Loaded == false) 
                HH.call('init.ready');

            // - - - (end) HackHands Integration - - - 
            return;
        });
 
        plugin.freezePublicAPI({
            example: function(){}
        });
 
        register(null, { "HackHands" : plugin });
    }















});