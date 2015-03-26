[zuora](https://github.com/DeadAlready/node-zuora) is a wrapper that allows easy operations through the Zuora REST API.
It uses the restify client to make requests and an internal validator to do basic validation beforehand.
It also parses the errors coming from zuora to provide a readable format if possible.

# Installation

    $ npm install zuora

# Usage

zuora exports the create method for creating a new zuora object

    var zuora = require('zuora');
    var client = zuora.create(config);

## Configuration

The following options are available:

+ user:(required)  *The user used to authenticate with zuora
+ password:(required) *The password for zuora user
+ log: *Bunyan logger
+ catalogTTL: *Time to live for the internal catalog cache
+ validation: *Options for the validation
+ url: *The zuora endpoint url
+ production: *If url is not provided then this flag will determine whether api or apisandbox-api.zuora.com will be used

## Methods

The zuora client will have the following objects

+ account - Wrapper for Account operations
  + create (data, callback) - Creates a customer account.
  + get (id, callback) - Retrieves basic information about a specified customer account.
  + summary (id, callback) - Retrieves detailed information about the specified customer account.
  + update (id, data, callback) - Updates the specified customer account.
+ catalog - Wrapper for Catalog operations
	+ get ([opts], callback) - Retrieves the entire product catalog, including all products and their corresponding rate plans and charges.
	+ query (params, callback) - Function for querying the product catalog.
+ payment - Wrapper for Payment operations
  + create (data, callback) - Creates a new credit card payment method for the specified customer account
  + get (id, [opts], callback) - Retrieves all credit card information for the specified customer account
  + update (id, data, callback) - Updates an existing credit card payment method for the specified customer account.
  + del (id, callback) - Deletes a credit card payment method from the specified customer account.
+ subscription - Wrapper for Subscription operations
	+ preview (opts, callback) - Method for getting a subscription preview
	+ create (opts, callback) - Method for creating a new subscription
	+ getByAccount (id, [opts], callback) - Method for getting subscriptions by account id
	+ getByKey (key, callback) - Method for getting a subscription by subscription key
	+ update (key, data, callback) - Method for updating a subscription
	+ renew (key, data, callback) - Method for renewing a subscription
	+ cancel (key, opts, callback) - Method for cancelling a subscription
+ transaction - Wrapper for Transaction operations
	+ getInvoices (id, [opts], callback) - Method for getting invoices of an account
	+ getPayments (id, [opts], callback) - Method for getting payments of an account
	+ collect (id, [opts], callback) - Generates invoices and collects payments for a specified account.

The Zuora documentation and examples can be found at
http://knowledgecenter.zuora.com/D_Zuora_APIs/REST_API/B_REST_API_reference

## License

The MIT License (MIT)
Copyright (c) 2013 Joyent, Inc., All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
