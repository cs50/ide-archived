'use strict';

var assert = require('assert');
var restify = require('restify');
var error = require('./error/error');
var query = require('querystring');
var utils = require('./utils');
var restAddon = '/rest/v1';

var info = require('../package.json');


/**
 * Wrapper for Restify client
 *
 * @param opts {Object} - initialization options
 * @param opts.user {String} - Zuora API account username
 * @param opts.password {String} - Zuora API account password
 * @param [opts.production=false] {Boolean} - whether to use production or sandbox
 * @returns {ZuoraClient}
 * @constructor
 */
function ZuoraClient(opts) {
    if(!(this instanceof ZuoraClient)) {
        return new ZuoraClient(opts);
    }

    assert.ok((opts && typeof opts === 'object'), 'opts must be an object');
    assert.ok(opts.user, 'opts.apiKey must be defined');
    assert.ok(opts.password, 'opts.apiSecret must be defined');
	if(opts.log) {
		opts.log = opts.log.child({component: info.name + '@' + info.version});
	}
	this.log = {
		child: function () {
			if(!opts.log) {
				return function(){};
			}
			var child = opts.log.child.apply(opts.log, arguments);
			return function (lvl) {
				var args = Array.prototype.slice.call(arguments, 1);
				child[lvl].apply(child, args);
			};
		}
	};
    var url = opts.url;
    if (!url) {
        url = (opts.production ? 'https://api.zuora.com' : 'https://apisandbox-api.zuora.com');
    }

    var client = restify.createJsonClient({
        url: url
    });

    client.basicAuth(opts.user, opts.password);

    this.client = client;
}

/**
 * Wrapper for get function - will build query string from opts and wrap callback in error handler
 *
 * @param path {String} - base path
 * @param [opts] {Object} - query parameters
 * @param callback {Function}
 */
ZuoraClient.prototype.get = function (path, opts, callback) {
    if(!callback) {
        callback = opts;
        opts = false;
    }
    if(opts) {
        path += '?' + query.stringify(opts);
    }
    path = restAddon + path;
	var log = this.log.child({method: 'GET', path: path});
	log('debug', 'Calling Zuora');
    this.client.get(path, error.getHandler(log, callback));
};

/**
 * Wrapper for del function - will build query string from opts and wrap callback in error handler
 *
 * @param path {String} - base path
 * @param [opts] {Object} - query parameters
 * @param callback {Function}
 */
ZuoraClient.prototype.del = function (path, opts, callback) {
    if(!callback) {
        callback = opts;
        opts = false;
    }
    if(opts) {
        path += '?' + query.stringify(opts);
    }
    path = restAddon + path;
	var log = this.log.child({method: 'DELETE', path: path});
	log('debug', 'Calling Zuora');
    this.client.del(path, error.getHandler(log, callback));
};

/**
 * Wrapper for put function - will wrap callback in error handler
 *
 * @param path {String} - base path
 * @param [object=undefined] {Object} - data to send
 * @param callback {Function}
 */
ZuoraClient.prototype.put = function (path, object, callback) {
    if(!callback) {
        callback = object;
        object = undefined;
    }
    path = restAddon + path;
	var log = this.log.child({method: 'PUT', path: path});
    if(object) {
	    log('debug',  {data: utils.cleanLogObject(object)}, 'Calling Zuora');
        this.client.put(path, object, error.getHandler(log, callback));
    } else {
	    log('debug', 'Calling Zuora');
        this.client.put(path, error.getHandler(log, callback));
    }
};

/**
 * Wrapper for post function - will wrap callback in error handler
 *
 * @param path {String} - base path
 * @param [object=undefined] {Object} - data to send
 * @param callback {Function}
 */
ZuoraClient.prototype.post = function (path, object, callback) {
    if(!callback) {
        callback = object;
        object = undefined;
    }
    path = restAddon + path;
	var log = this.log.child({method: 'POST', path: path});
    if(object) {
	    log('debug', {data: utils.cleanLogObject(object)}, 'Calling Zuora');
        this.client.post(path, object, error.getHandler(log, callback));
    } else {
	    log('debug', 'Calling Zuora');
        this.client.post(path, error.getHandler(log, callback));
    }
};

module.exports = ZuoraClient;