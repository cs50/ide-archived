'use strict';

var util = require('util');

module.exports = util;

module.exports.cleanLogObject = function cleanLogObject(object) {
	if(!object || typeof object !== 'object') {
		return object;
	}
	var cleanObj = {};
	if(util.isArray(object)) {
		cleanObj = [];
		object.forEach(function (el) {
			cleanObj.push(cleanLogObject(el));
		});
	}
	Object.keys(object).forEach(function (key) {
		if(typeof object[key] === 'object') {
			cleanObj[key] = cleanLogObject(object[key]);
		} else {
			if(key === 'creditCardNumber' || key === 'cardNumber') {
				var card = object[key];
				card.replace(/\s/g, '');
				var clean = '';
				for(var i = 0; i < (card.length - 4); i++) {
					clean += '*';
				}
				clean += card.substr(card.length - 4);
				cleanObj[key] = clean;
			} else if(key === 'securityCode') {
				var cleanSec = '';
				for(var i = 0; i < object[key].length; i++) {
					cleanSec += '*';
				}
				cleanObj[key] = cleanSec;
			} else {
				cleanObj[key] = object[key];
			}
		}
	});
	return cleanObj;
};