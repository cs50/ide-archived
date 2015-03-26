/*global describe it before after */

"use mocha";


if (typeof process !== "undefined")
    require("amd-loader");

define(function(require, exports, module) {
    var vfshook = require("./libmongolab");
    var expect = require("chai").expect;
    var api;
    
    describe('mongolab', function() {
        this.timeout(10000);
        
        before(function(done) {
            vfshook(null, function(a, b){ api = b; });
            
            // Make sure the account is no longer existent
            api.deleteAccount(function(err, data) {
                done();
            });
        });
        
        describe("createAccount", function(){
            it("should create an account that doesn't exist yet", function(done) {
                api.createAccount(function(err, data) {
                    if (err) throw err;
                    expect(data).property("password").to.exist;
                    done();
                });
            });
            it("should fail to create an account that already exists", function(done) {
                api.createAccount(function(err, data) {
                    expect(err).to.ok;
                    expect(data).to.not.ok;
                    done();
                });
            });
        });
        describe("createDatabase", function(){
            it("should create a database under the user account that doesn't exist yet", function(done) {
                api.createDatabase({name: "test" }, function(err, data) {
                    if (err) throw err;
                    expect(data).property("uri").to.exist;
                    done();
                });
            });
            it("should fail to create a database under the user account that already exists", function(done) {
                api.createDatabase({name: "test" }, function(err, data) {
                    expect(err).to.ok;
                    expect(data).to.not.exist;
                    done();
                });
            });
        });
        describe("createDatabase", function(){
            it("should list databases under the user account", function(done) {
                api.listDatabases(function(err, data) {
                    if (err) throw err;
                    expect(data).length(1);
                    done();
                });
            });
        });
        describe("deleteDatabase", function(){
            it("should create a database under the user account that doesn't exist yet", function(done) {
                api.deleteDatabase({name: "test" }, function(err, data) {
                    if (err) throw err;
                    expect(data).to.ok;
                    done();
                });
            });
            it("should fail to create a database under the user account that already exists", function(done) {
                api.deleteDatabase({name: "test" }, function(err, data) {
                    expect(err).to.ok;
                    expect(data).to.not.ok;
                    done();
                });
            });
        });
        describe("getDashboardUrl", function(){
            it("should get the url that will gain access to the dashboard", function(done) {
                api.getDashboardUrl(function(err, data) {
                    if (err) throw err;
                    expect(data).to.ok;
                    done();
                });
            });
        });
        describe("deleteAccount", function(){
            it("should delete a account that exists", function(done) {
                api.deleteAccount(function(err, data) {
                    if (err) throw err;
                    expect(data).to.ok;
                    done();
                });
            });
            it("should fail to delete a account that doesn't exist", function(done) {
                api.deleteAccount(function(err, data) {
                    expect(err).to.ok;
                    expect(data).to.not.ok;
                    done();
                });
            });
        });
    });
});