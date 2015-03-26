# SimpleFunc

Simple object with functions encode/decode, serialization/deserialization.

## Installation

Via npm on Node:

```
npm install simplefunc
```


## Usage

Sometimes, you need to define an object with attributes and functions, and send it to other machine or process. Functions are
not serialized, so, an special processing is needed. SimpleFunc is a helper to encode objects with instance funcions so they
can be serialized/deserializas from/to JSON. You can encode, decode without using JSON, too.

Reference in your program:
```js
var simplefunc = require('simplefunc');
```

Encoding a value
```js
var encoded = simplefunc.encode(value);
```
Most value are encoded as themselves. The current implementation returns an encoded result if the original value is
an object and it has functions. If value is an object with functions, an object is returned, with two properties:

- `_obj`: with the properties of the original value, that are NOT functions.
- `_fns`: with the properties of the original value that ARE functions, encoding in an array with its parameters and code

Only the first level of properties is encoded: no attempt to make a deep encode (maybe in next versions).

If the value to encode is a function, an object is returned with an attribute `_fn` with an array containing the original
function arguments and code serialized to string.

Encoding and decoding a value
```js
var encoded = simplefunc.encode(value);
var newvalue = simplefunc.decode(encoded);
```

You can convert a value to/from a JSON string:
```js
var json = simplefunc.toJson(value);
var newvalue = simplefunc.fromJson(encoded);
```

## Development

```
git clone git://github.com/ajlopez/SimpleFunc.git
cd SimpleFunc
npm install
npm test
```

## Samples

TBD

## To do

- Samples
- Deep processing

## Versions

- 0.0.1 Published.
- 0.0.2 Published. Fixed null processing.

## Contribution

Feel free to [file issues](https://github.com/ajlopez/SimpleFunc) and submit
[pull requests](https://github.com/ajlopez/SimpleFunc/pulls) — contributions are
welcome.

If you submit a pull request, please be sure to add or update corresponding
test cases, and ensure that `npm test` continues to pass.

