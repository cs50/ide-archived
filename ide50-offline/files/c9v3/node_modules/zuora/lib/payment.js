'use strict';

var validation = require('./validation');

/**
 * Wrapper for Payment operations
 *
 * @param opts {Object} - initialization options
 * @param opts.client {Object} - restify client wrapper to use
 * @param [opts.validation] {Object} - options for validator initialization
 * @returns {Payment}
 * @constructor
 */
function Payment(options) {
    if(!(this instanceof Payment)) {
        return new Payment(options);
    }

    this.client = options.client;
    this.validate = validation(options.validation);
}
/**
 * Creates a new credit card payment method for the specified customer account
 *
 * @param data {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Payment_methods/1_Create_payment_method
 * @param callback {Function}
 */
Payment.prototype.create = function(data, callback) {
    var err = this.validate('paymentCreate', data);
    if(err) {
        setImmediate(function () {
            callback(err);
        });
        return;
    }

    this.client.post('/payment-methods/credit-cards', data, callback);
};

/**
 * Retrieves all credit card information for the specified customer account
 *
 * @param id {String} - Account Id
 * @param [opts=false] {Object}
 * @param [opts.pageSize=20] {Integer} - how many creditCards on one page
 * @param callback
 */
Payment.prototype.get = function (id, opts, callback) {
    if(!callback) {
        callback = opts;
        opts = false;
    }
    this.client.get('/payment-methods/credit-cards/accounts/' + id, opts, callback);
};

/**
 * Updates an existing credit card payment method for the specified customer account.
 *
 * @param id {String} - Payment method id
 * @param data {Object} - refer to http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference/Payment_methods/3_Update_payment_method
 * @param callback {Function}
 */
Payment.prototype.update = function (id, data, callback) {
    var err = this.validate('paymentUpdate', data);
    if(err) {
        setImmediate(function () {
            callback(err);
        });
        return;
    }
    this.client.put('/payment-methods/credit-cards/' + id, data, callback);
};
/**
 * Deletes a credit card payment method from the specified customer account.
 *
 * @param id {String} - Payment method id
 * @param callback {Function}
 */
Payment.prototype.del = function (id, callback) {
    this.client.del('/payment-methods/' + id, callback);
};

module.exports = Payment;