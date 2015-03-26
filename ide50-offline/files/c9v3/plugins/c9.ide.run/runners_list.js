var fs = require("fs");

function readRunners(path) {
    var results = {};
    var runnersPath = __dirname + "/" + path + "/";
    fs.readdirSync(runnersPath).forEach(function (name) {
        var json;
        try {
            json = JSON.parse(fs.readFileSync(runnersPath + name, "utf8").replace(/(^|\n)\s*\/\/.*$/mg, ""));
        } catch (e) {
            console.error("Syntax error in runner", runnersPath + name, e);
            throw e;
        }
        json.caption = name.replace(/\.run$/, "");
        json.$builtin = true;
        results[json.caption] = json;
    });
    return results;
}

var defaultRunners = readRunners("runners");

module.exports = {
    local: defaultRunners,
    ssh: defaultRunners,
    docker: readRunners("runners-docker")
};