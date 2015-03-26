
"use server";

var testFw = require('./framework');

module.exports = testFw.buildTest('bigfile.js', 'exports');

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec();
}
