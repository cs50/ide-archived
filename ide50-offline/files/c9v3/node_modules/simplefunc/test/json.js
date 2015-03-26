
var simplefunc = require('../'),
    assert = require('assert');

// json functions defined

assert.ok(simplefunc.toJson);
assert.equal(typeof simplefunc.toJson, 'function');
assert.ok(simplefunc.fromJson);
assert.equal(typeof simplefunc.fromJson, 'function');

function process(value) {
    var json = simplefunc.toJson(value);
    return simplefunc.fromJson(json);
}

var value = 3;
assert.equal(process(value), value);

var value = "foo";
assert.equal(process(value), value);

var value = [1,2,3];
assert.deepEqual(process(value), value);

var value = { a: 1, b: 2 };
assert.deepEqual(process(value), value);

// process function

function foo(a, b) {
    return a+b;
};

var result = process(foo);
assert.ok(result);
assert.equal(typeof result, 'function');
assert.equal(result(1,2), 3);

// process object with function

var obj = { a: 1, b: 2, foo: function (a, b) { return a+b; } };

var result = process(obj);
assert.ok(result);
assert.ok(result.a);
assert.equal(result.a, 1);
assert.ok(result.b);
assert.equal(result.b, 2);
assert.ok(result.foo);
assert.equal(typeof result.foo, 'function');
assert.equal(result.foo(1,2), 3);

// null toJson

assert.equal(simplefunc.toJson(null), "null");

// null fromJson

assert.equal(simplefunc.fromJson("null"), null);
