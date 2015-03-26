cd `dirname $0`/..

dest='plugins/c9.ide.format/formatters/lib_jsbeautify.js'
src=https://raw.githubusercontent.com/beautify-web/js-beautify/master/js/lib/
echo "define(['require', 'exports', 'module'], function(_r, _e, module) {
var define, window = module.exports = {};" > $dest
curl $src/beautify.js >> $dest
curl $src/beautify-css.js >> $dest
curl $src/beautify-html.js >> $dest
echo "});" >> $dest

# node -e "
#     var fs = require('fs');
#     var src = fs.readFileSync('$dest', 'utf8');
#     var result = require('architect-build/compress')(src, {obfuscate: true, oneLine: true})
#     fs.writeFileSync('$dest', result.code, 'utf8');
# "