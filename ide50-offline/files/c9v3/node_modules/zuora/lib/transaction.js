'use strict';

var validation = require('./validation');

/**
 * Wrapper for Transaction operations
 *
 * @param opts {Object} - initialization options
 * @param opts.client {Object} - restify client wrapper to use
 * @param [opts.validation] {Object} - options for validator initialization
 * @returns {Transaction}
 * @constructor
 */
function Transaction(opts) {
    if(!(this instanceof Transaction)) {
        return new Transaction(opts);
    }
    this.client = opts.client;
    this.validate = validation(opts.validation);
}

/**
 * Method for getting invoices of an account
 *
 * @param id {String} - Account Id
 * @param [opts=false] {Object}
 * @param [opts.pageSize=20] {Integer} - how many invoices on one page
 * @param callback
 */
Transaction.prototype.getInvoices = function (id, opts, callback) {
    var self = this;
    if(!callback) {
        callback = opts;
        opts = false;
    }

    self.client.get('/transactions/invoices/accounts/' + id, opts, callback);
};

/**
 * Method for getting payments of an account
 *
 * @param id {String} - Account Id
 * @param [opts=false] {Object}
 * @param [opts.pageSize=20] {Integer} - how many payments on one page
 * @param callback
 */
Transaction.prototype.getPayments = function (id, opts, callback) {
    var self = this;
    if(!callback) {
        callback = opts;
        opts = false;
    }

    self.client.get('/transactions/payments/accounts/' + id, opts, callback);
};

/**
 * Generates invoices and collects payments for a specified account.
 *
 * @param [id] {String} - Account Id
 * @param opts {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Transactions/Invoice_and_collect
 * @param opts.accountKey {String} - account to collect for, if id is defined then this is overwritten
 * @param callback
 */
Transaction.prototype.collect = function (id, opts, callback) {
    if(typeof id === 'object') {
        callback = opts;
        opts = id;
        id = false;
    }
    if(typeof opts === 'function') {
        callback = opts;
        opts = {};
    }
    if(id) {
        opts.accountKey = id;
    }

    var errs = this.validate('collect', opts);

    if(errs) {
        setImmediate(function () {
            callback(errs);
        });
        return;
    }

    this.client.post('/operations/invoice-collect', opts, callback);
};

module.exports = Transaction;