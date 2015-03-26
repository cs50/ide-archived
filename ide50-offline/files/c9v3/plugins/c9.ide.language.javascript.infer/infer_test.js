
"use server";

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(require('./test/aceeditor_test')).exec()
}