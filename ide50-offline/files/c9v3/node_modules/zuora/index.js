'use strict';

var Client = require('./lib/client');
var Catalog = require('./lib/catalog');
var Payment = require('./lib/payment');
var Account = require('./lib/account');
var Transaction = require('./lib/transaction');
var Subscription = require('./lib/subscription');

function Zuora(options) {
    if(!(this instanceof Zuora)) {
        return new Zuora(options);
    }

    var client = new Client(options);

    this.catalog = new Catalog({client: client, validation: options.validation, ttl: options.catalogTTL});
    this.account = new Account({client: client, validation: options.validation});
    this.payment = new Payment({client: client, validation: options.validation});
    this.transaction = new Transaction({client: client, validation: options.validation});
    this.subscription = new Subscription({client: client, validation: options.validation});
}

module.exports.create = function (opts) {
    return new Zuora(opts);
};

module.exports.currencies = require('./lib/validation/currencies');
module.exports.states = require('./lib/validation/states');
module.exports.countries = require('./lib/validation/countries');