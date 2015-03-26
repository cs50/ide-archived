
var simplefunc = require('../'),
    assert = require('assert');

// encode defined

assert.ok(simplefunc.encode);
assert.equal(typeof simplefunc.encode, 'function');

var value = 3;
assert.equal(simplefunc.encode(value), value);

var value = "foo";
assert.equal(simplefunc.encode(value), value);

var value = [1,2,3];
assert.equal(simplefunc.encode(value), value);

var value = { a: 1, b: 2 };
assert.equal(simplefunc.encode(value), value);

// encode function

function foo(a, b) {
    return a+b;
};

var result = simplefunc.encode(foo);
assert.ok(result);
assert.ok(result._fn);
assert.equal(result._fn.length, 3);
assert.equal(result._fn[0], 'a');
assert.equal(result._fn[1], 'b');
assert.equal(result._fn[2], 'return a+b;');

// encode object with function

var obj = { a: 1, b: 2, foo: function (a, b) { return a+b; } };

var result = simplefunc.encode(obj);
assert.ok(result);
assert.ok(result._obj);
assert.ok(result._obj.a);
assert.equal(result._obj.a, 1);
assert.ok(result._obj.b);
assert.equal(result._obj.b, 2);
assert.ok(result._fns);
assert.ok(result._fns.foo);
assert.equal(result._fns.foo[0], 'a');
assert.equal(result._fns.foo[1], 'b');
assert.equal(result._fns.foo[2], 'return a+b;');
