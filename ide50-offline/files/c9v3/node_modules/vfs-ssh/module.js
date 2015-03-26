// Super simple require system
(function () {

// Store our repository in private variables in this closure.
var defs = {},
    modules = {};

// When the user defines a module's setup function, store it here.
define = function define(name, fn) {
  defs[name] = fn;
};

var realRequire = typeof require !== "undefined" && require;
// The first time a module is used, it's description is executed and cached.
require = function require(name) {
  if (modules.hasOwnProperty(name)) return modules[name];
  if (defs.hasOwnProperty(name)) {
    var exports = modules[name] = {};
    var module = {exports:exports};
    var fn = defs[name];
    fn(module, exports);
    return modules[name] = module.exports;
  }
  if (realRequire) {
    return realRequire(name);
  }
  throw new Error("Can't find module " + name);
};

}());
