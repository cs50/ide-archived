
var simplefunc = require('../'),
    assert = require('assert');

// decode defined

assert.ok(simplefunc.decode);
assert.equal(typeof simplefunc.decode, 'function');

var value = 3;
assert.equal(simplefunc.decode(value), value);

var value = "foo";
assert.equal(simplefunc.decode(value), value);

var value = [1,2,3];
assert.equal(simplefunc.decode(value), value);

var value = { a: 1, b: 2 };
assert.equal(simplefunc.decode(value), value);

// decode function

function foo(a, b) {
    return a+b;
};

var coded = simplefunc.encode(foo);
var result = simplefunc.decode(coded);
assert.ok(result);
assert.equal(typeof result, 'function');
assert.equal(result(1,2), 3);

// decode object with function

var obj = { a: 1, b: 2, foo: function (a, b) { return a+b; } };

var coded = simplefunc.encode(obj);
var result = simplefunc.decode(coded);
assert.ok(result);
assert.ok(result.a);
assert.equal(result.a, 1);
assert.ok(result.b);
assert.equal(result.b, 2);
assert.ok(result.foo);
assert.equal(typeof result.foo, 'function');
assert.equal(result.foo(1,2), 3);

// encode null

assert.equal(simplefunc.encode(null), null);

// decode null

assert.equal(simplefunc.decode(null), null);