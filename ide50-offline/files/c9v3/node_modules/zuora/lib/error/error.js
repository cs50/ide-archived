'use strict';

var codes = require('./codes');

function splitError(code) {
    code = code + '';
    var entry = code.substr(0, 1);
    var object = code.substr(1, 3);
    var field = code.substr(4, 2);
    var category = code.substr(6, 2);

    var o = codes.objects[object];
    return {
        entry: {
            name: codes.entries[entry],
            nr: entry
        },
        object: {
            name: o,
            nr: object
        },
        field: {
            name: field === '00' && '_general' || codes.fields[o] && codes.fields[o][field] || undefined,
            nr: field
        },
        category: {
            name: codes.categories[category],
            nr: category
        }
    };
}

function translateError(code) {
    var c = splitError(code);

    return (c.entry.name + ': ' + c.object.name + ',' + (c.field.name || c.field.nr) + ' - ' + c.category.name);
}
// Function for translating zuora error codes into a more usable format
module.exports.getHandler = function (log, message, callback) {
	if(typeof message === 'function') {
		callback = message;
		message = 'Unable to reach Zuora: %j';
	}
    return function (err, req, res, obj) {
        if (err) {
            log('error', message, err);
            callback(err);
            return;
        }
        if (typeof obj !== 'object' || obj.success === undefined) {
            callback(new TypeError('Invalid response'));
            return;
        }
        if(!obj.success) {
            var err = new Error('Zuora Internal error');
            obj.reasons.forEach(function (r, i) {
                obj.reasons[i].human = translateError(r.code);
                obj.reasons[i].split = splitError(r.code);
                err[obj.reasons[i].split.field.name] = (obj.reasons[i].split.category.nr === '30' ? r.message : obj.reasons[i].split.category.name);
                if(r.message === 'Expiration date must be a future date.') { // Hacking
                    err[obj.reasons[i].split.object.name === 'POSTAccount' ? 'creditCard.expirationMonth' : 'expirationMonth'] = r.message;
                    err[obj.reasons[i].split.object.name === 'POSTAccount' ? 'creditCard.expirationYear' : 'expirationYear'] = r.message;
                }
                if(r.message && r.message.indexOf('The credit card number is invalid.') !== -1) {
                    err[obj.reasons[i].split.object.name === 'POSTPaymentMethod' ? 'creditCardNumber' : 'creditCard.cardNumber'] = r.message;
                }
            });
            callback(err, obj);
            return;
        }
        callback(null, obj);
    }
};