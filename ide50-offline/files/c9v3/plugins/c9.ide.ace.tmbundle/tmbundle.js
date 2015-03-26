var fs = require('fs')
var plist = require('plist')
var lib = require('./lib')

var snippets = [];
var path = process.argv[2] || process.cwd();
function readSnippet(path, name) {
    if (name)
        path += name
    console.log(name)
    if (!/\.(tmSnippet|sublime-snippet|plist)$/i.test(path))
        return
    console.log(name)
    var plistString = fs.readFileSync(path, "utf8");
    plist.parseString(plistString, function(_, plist){
        snippets.push(plist)
    })
}

// read
function readDir(path) {
    if (fs.statSync(path).isDirectory()) {
        path += "/"
        fs.readdirSync(path).forEach(function(name) {        
            if (/snippets/i.test(name))
                readSnippetsInDir(path + name)
            else
                readDir(path + name)
        })
    }
}
function readSnippetsInDir(path) {
    if (fs.statSync(path).isDirectory()) {
        path += "/"
        snippets.push(path)
        fs.readdirSync(path).forEach(function(name) {
            readSnippet(path, name)
        })
    } else {
        readSnippet(path)
    }
}
readDir(path) 
// transform
snippets = snippets.map(function(s) {
    if (s.length == 1)
        s = s[0]
    if (s.scope)
        s.scope = s.scope.replace(/source\./g, "")
    delete s.uuid
    return s
})

// stringify 
// todo do we need to convert into new form?
var text = JSON.stringify(snippets, null, 4)


var template = fs.readFileSync(__dirname + "/tmsnippets.tmpl.js", "utf8");

var languageName = lib.snakeCase(language.name).replace(/[^\w]/g, "");

text = lib.fillTemplate(template, {
    languagename: languageName,
    snippets: text
});

fs.writeFileSync(lib.AceRoot + "ace/snippets/" + name + ".js", text)

console.log("created file " + path)


text = lib.fillTemplate(template, {
    languagename: languageName,
    snippets: text
});

fs.writeFileSync(lib.AceRoot + "ace/snippets/" + name + ".js", snippets.map(function(s) {}).join("\n"))
