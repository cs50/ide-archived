'use strict';

var validation = require('./validation');

/**
 * Wrapper for Account operations
 *
 * @param opts {Object} - initialization options
 * @param opts.client {Object} - restify client wrapper to use
 * @param [opts.validation] {Object} - options for validator initialization
 * @returns {Account}
 * @constructor
 */
function Account(options) {
    if(!(this instanceof Account)){
        return new Account(options);
    }

    this.client = options.client;
    this.validate = validation(options.validation);
}

/**
 * Creates a customer account.
 *
 * @param data {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Accounts/1_Create_account
 * @param callback {Function}
 */
Account.prototype.create = function (data, callback) {
    var err = this.validate('accountCreate', data);
    if(err) {
        setImmediate(function () {
            callback(err);
        });
        return;
    }

    this.client.post('/accounts', data, callback);
};

/**
 * Retrieves basic information about a specified customer account.
 *
 * @param id {String} - Account Id
 * @param callback {Function}
 */
Account.prototype.get = function (id, callback) {
    this.client.get('/accounts/' + id, callback);
};

/**
 * Retrieves detailed information about the specified customer account.
 *
 * @param id {String} - Account Id
 * @param callback {Function}
 */
Account.prototype.summary = function (id, callback) {
    this.client.get('/accounts/' + id + '/summary', callback);
};

/**
 * Updates the specified customer account.
 *
 * @param id {String} - Account Id
 * @param data {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Accounts/4_Update_account
 * @param callback {Function}
 */
Account.prototype.update = function (id, data, callback) {
    this.client.put('/accounts/' + id, data, callback);
};

module.exports = Account;