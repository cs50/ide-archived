#!/usr/bin/env node
/*global describe it before after beforeEach afterEach */
"use strict";

"use server";
"use mocha";

// Test flags
//
// "use root";      the unit test will be executed as root (using sudo); use with care! (ex. back-up / restore tests)
// "use non-osx";   test will be skipped if the operating system is Mac OS
// "use server";    tests are supposed to run on server-side (either with node or mocha)
// "use client";    tests are run by means of Selenium on client side
// "use mocha";     tests can be run by mocha or by node; this label indicates needs be run using mocha.

require("c9/inline-mocha")(module);
if (typeof define === "undefined") {
    require("amd-loader");
    require("../../test/setup_paths");
}

var expect = require("chai").expect;
var assert = require("assert");
var sinon = require("sinon");

describe("The Module", function(){
    this.timeout(2000);

    beforeEach(function() {
    });

    afterEach(function () {
    });
    
    it("has a sync test", function() {
    });
    
    it("has a async test", function(done) {
        done();
    });
    
    it("has a failing test", function() {
        assert.equal(10, 11);
    });
});