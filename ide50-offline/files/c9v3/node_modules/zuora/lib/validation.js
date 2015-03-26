'use strict';

var countries = require('./validation/countries');
var states = require('./validation/states');
var currencies = require('./validation/currencies');

var check = require('validator').check;

module.exports = function (opts) {

    opts = opts || {};

    // Rules for validating query objects and parameters
    var validationObjects = {
        creditCardType: {
            notEmpty: [],
            isIn : [['Visa','AmericanExpress','MasterCard','Discover']]
        },
        creditCardNumber: {
            notEmpty: [],
            isCreditCard: []
        },
        expirationMonth: {
            notEmpty: [],
            len: [2, 2],
            isNumeric: [],
            min: [1],
            max: [12],
            future: function (month, obj) {
                var date = new Date();
                var y = date.getFullYear();
                var m = date.getMonth();

                if((+obj.expirationYear < y) || (+obj.expirationYear === +y && +month <= +m)) {
                    throw new Error('Must be future date');
                }
            }
        },
        expirationYear: {
            notEmpty: [],
            len: [4, 4],
            isNumeric: [],
            min: [2013],
            max: [2030],
            future: function (year, obj) {
                var date = new Date();
                var y = date.getFullYear();
                var m = date.getMonth();

                if((+year < +y) || (+year === +y && +obj.expirationMonth <= +m)) {
                    throw new Error('Must be future date');
                }
            }
        },
        securityCode: {
            notEmpty: [],
            length: function (ccv, obj) {
                if(!obj.creditCardType || obj.creditCardType === 'AmericanExpress') {
                    check(ccv).len(3,4);
                } else {
                    check(ccv).len(3,3);
                }
            }
        },
        cardHolderName: {
            notEmpty: []
        },
        city: {
            notEmpty: []
        },
        country: {
            isIn: [countries.getArray(opts.countries, true)]
        },
        state: function (data) {
            if(['Canada','CAN','United States','USA'].indexOf(data.country) === -1) {
                return {};
            }
            var validate = {
                notEmpty: []
            };
            if(['Canada','CAN'].indexOf(data.country) !== -1) {
                validate.isIn = [states.canada.all]
            } else {
                validate.isIn = [states.us.all]
            }
            return validate;
        },
        zipCode: {
            notEmpty: []
        },
        termType: {
            notEmpty: [],
            isIn: [[ 'TERMED', 'EVERGREEN']]
        },
        contractEffectiveDate: {
            notEmpty: [],
            isDate: [],
            length: [10, 10]
            //maybe should also check if is yyyy-mm-dd
        },
        subscribeToRatePlans: {
            notEmpty:[],
            subObjects: {
                productRatePlanId: {
                    notEmpty:[]
                }
            }
        }
    };

    // Grouping validation objects into query specific objects
    var validationRules = {
        paymentCreate: {
            accountKey: {
                notEmpty: []
            },
            creditCardType: validationObjects.creditCardType,
            creditCardNumber: validationObjects.creditCardNumber,
            expirationMonth: validationObjects.expirationMonth,
            expirationYear: validationObjects.expirationYear,
            securityCode: validationObjects.securityCode,
            cardHolderInfo: {
                subObjects: {
                    cardHolderName: validationObjects.cardHolderName,
                    city: validationObjects.city,
                    country: validationObjects.country,
                    state: validationObjects.state,
                    zipCode: validationObjects.zipCode
                }
            }
        },
        paymentUpdate: {
            expirationMonth: validationObjects.expirationMonth,
            expirationYear: validationObjects.expirationYear,
            securityCode: validationObjects.securityCode,
            cardHolderName: validationObjects.cardHolderName,
            city: validationObjects.city,
            country: validationObjects.country,
            state: validationObjects.state,
            zipCode: validationObjects.zipCode
        },
        accountCreate: {
            accountNumber: {
                notEmpty: []
            },
            name: {
                notEmpty: []
            },
            currency: {
                notEmpty: [],
                isIn: [currencies.currencies.all]
            },
            paymentTerm: {
                notEmpty: [],
                isIn: [[ 'Due Upon Receipt', 'Net 30', 'Net 60', 'Net 90']]
            },
            billToContact: {
                notNull: [],
                subObjects: {
                    firstName: {
                        notEmpty: []
                    },
                    lastName: {
                        notEmpty: []
                    }
                }
            }
        },
        collect: {
            accountKey: {
                notEmpty: []
            }
        },
        subscriptionPreview: {
            accountKey: {
                conditional: function (val, obj) {
                    if(!val && !obj.previewAccountInfo) {
                        throw new Error('Either accountKey or previewAccountInfo must be defined');
                    }
                }
            },
            previewAccountInfo: {
                conditional: function (val, obj) {
                    if(!val && !obj.accountKey) {
                        throw new Error('Either accountKey or previewAccountInfo must be defined');
                    }
                }
            },
            termType: validationObjects.termType,
            contractEffectiveDate: validationObjects.contractEffectiveDate,
            initialTerm: function (obj) {
                if(obj.termType === 'TERMED') {
                    return {
                        notEmpty: [],
                        isInt: [],
                        min: [1]
                    };
                }
                return {};
            },
            subscribeToRatePlans: validationObjects.subscribeToRatePlans
        },
        subscriptionCreate: {
            accountKey: {
                notEmpty: []
            },
            termType: validationObjects.termType,
            contractEffectiveDate: validationObjects.contractEffectiveDate,
            subscribeToRatePlans: validationObjects.subscribeToRatePlans
        },
        subscriptionCancel: {
            cancellationPolicy: {
                notEmpty: [],
                isIn: [['EndOfCurrentTerm', 'EndOfLastInvoicePeriod', 'SpecificDate']]
            },
            cancellationEffectiveDate: function (obj) {
                if(obj.cancellationPolicy === 'SpecificDate') {
                    return validationObjects.contractEffectiveDate;
                }
                return {};
            },
            invoiceCollect: {
                notEmpty: [],
                isIn: [[true, false]]
            }
        }
    };

    return function (type, data) {
        if(typeof data !== 'object') {
            return new TypeError('Input data missing');
        }

        // Get request rules
        var allRules = validationRules[type];

        if(!allRules) { // No rules, no validation
            return null;
        }

        var errors = [];

        // Function for checking a level of the data object
        function checkCycle(obj, rules, pre) {
            Object.keys(rules).forEach(function (name) {
                var rule;
                // If rule definer is a function then execute
                if(typeof rules[name] === 'function') {
                    rule = rules[name](obj);
                } else {
                    rule = rules[name];
                }
                Object.keys(rule).some(function (fn) {
                    // If we are not dealing with subObjects
                    if(fn !== 'subObjects') {
                        try {
                            var val = typeof (obj[name]) === 'string' ? obj[name].trim() : obj[name];
                            //If it is a function then execute
                            if(typeof rule[fn] === 'function') {
                                rule[fn](val, obj);
                            //If it has defined input then apply to validator
                            } else if (rule[fn].length) {
                                var a = check(val);
                                a[fn].apply(a, rule[fn]);
                            //Otherwise just execute validator
                            } else {
                                check(val)[fn]();
                            }
                        } catch (e) {
                            errors.push({name: (pre ? pre + '.' + name : name), message: e.message, fn: fn, v: obj[name]});
                            return true;
                        }
                    } else {
                        checkCycle(obj[name], rule[fn], (pre ? pre + '.' + name : name));
                    }
                    return false;
                });
            });
        }

        checkCycle(data, allRules);

        var ret = null;

        if(errors.length) {
            ret = {};
            errors.forEach(function (err) {
                ret[err.name] = err.message;
            });
        }


        return ret;
    };
};

