require("amd-loader");
var fs = require("fs");

fs.readdirSync(__dirname).forEach(function(filename) {
    var m = filename.match(/^([A-Z].*)(Test)?\.js$/);

    if (m && !m[2]) {
        var name = m[1];
        exports.__defineGetter__(name, function(){
            return require("./" + name);
        });
  }
});