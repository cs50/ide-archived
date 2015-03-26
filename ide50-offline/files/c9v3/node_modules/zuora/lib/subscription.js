'use strict';

var validation = require('./validation');

/**
 * Wrapper for Subscription operations
 *
 * @param opts {Object} - initialization options
 * @param opts.client {Object} - restify client wrapper to use
 * @param [opts.validation] {Object} - options for validator initialization
 * @returns {Subscription}
 * @constructor
 */
function Subscription(opts) {
    if(!(this instanceof Subscription)) {
        return new Subscription(opts);
    }
    this.client = opts.client;
    this.validate = validation(opts.validation);
}

/**
 * Method for getting a subscription preview
 *
 * @param opts {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Subscriptions/01_Preview_Subscription
 * @param callback {Function}
 */
Subscription.prototype.preview = function (opts, callback) {
    var errs = this.validate('subscriptionPreview', opts);
    if(errs) {
        setImmediate(function () {
            callback(errs);
        });
        return;
    }

    this.client.post('/subscriptions/preview', opts, callback);
};

/**
 * Method for creating a new subscription
 *
 * @param opts {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Subscriptions/02_Create_Subscription
 * @param callback {Function}
 */
Subscription.prototype.create = function (opts, callback) {
    var errs = this.validate('subscriptionCreate', opts);
    if(errs) {
        setImmediate(function () {
            callback(errs);
        });
        return;
    }

    this.client.post('/subscriptions', opts, callback);
};

/**
 * Method for getting subscriptions by account id
 *
 * @param id {String} - account id
 * @param [opts=false] {Object}
 * @param [opts.pageSize=20] {Integer} - how many subscriptions on one page
 * @param callback {Function}
 */
Subscription.prototype.getByAccount = function (id, opts, callback) {

    if(!callback) {
        callback = opts;
        opts = false;
    }

    this.client.get('/subscriptions/accounts/' + id, opts, callback);
};

/**
 * Method for getting a subscription by subscription key
 *
 * @param key {String} - Subscription key
 * @param callback {Function}
 */
Subscription.prototype.getByKey = function (key, callback) {
    this.client.get('/subscriptions/' + key, callback);
};

/**
 * Method for updating a subscription
 *
 * @param key {String} - Subscription key
 * @param data {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Subscriptions/5_Update_Subscription
 * @param callback {Function}
 */
Subscription.prototype.update = function (key, data, callback) {
    this.client.put('/subscriptions/' + key, data, callback);
};

/**
 * Method for renewing a subscription
 *
 * @param key {String} - Subscription key
 * @param data {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Subscriptions/6_Renew_Subscription
 * @param callback {Function}
 */
Subscription.prototype.renew = function (key, data, callback) {
    this.client.put('/subscriptions/' + key + '/renew', data, callback);
};

/**
 * Method for cancelling a subscription
 *
 * @param key {String} - Subscription key
 * @param opts {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Subscriptions/7_Cancel_Subscription
 * @param callback {Function}
 */
Subscription.prototype.cancel = function (key, opts, callback) {
    var errs = this.validate('subscriptionCancel', opts);
    if(errs) {
        setImmediate(function () {
            callback(errs);
        });
        return;
    }

    this.client.put('/subscriptions/' + key + '/cancel', opts, callback);
};

module.exports = Subscription;