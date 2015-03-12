#!/usr/bin/env nodejs
//
// This is CS50 Check.
//
// David J. Malan
// malan@harvard.edu
//

// version
var VERSION = '1.19';

// endpoint
var ENDPOINT = 'https://sandbox.cs50.net';

// modules
var argv =
    require('../lib/node_modules/optimist').boolean(['d','h','v','c'])
    .alias('d', 'debug').alias('h', 'help').alias('v', 'version').alias('c', 'coupon').argv;
var async = require('../lib/node_modules/async');
var child_process = require('child_process');
var fs = require('fs');
var JSZip = require('../lib/node_modules/node-zip');
var path = require('path');
var request = require('../lib/node_modules/request');
var _ = require('../lib/node_modules/underscore');
var wrench = require('../lib/node_modules/wrench');

// -v, --version
if (argv.version === true) {
    process.stdout.write(VERSION + '\n');
    process.exit(0);
}

// -h, --help
if (argv.help === true) {
    process.stdout.write('Usage: check50 id path [path ...]\n');
    process.exit(0);
}
else if (argv._.length < 2) {
    process.stderr.write('Usage: check50 id path [path ...]\n');
    process.exit(1);
}

// prepare to union paths
var paths = [];

// iterate over roots
_.each(argv._.slice(1), function(root) {

    // resolve root to absolute path so that we can trim longest common prefix
    root = path.resolve(root);

    // TODO: Add "\rValidating foo.c..." output, then output " Not found.",
    // rather than printing full path

    // ensure path exists
    if (!fs.existsSync(root)) {
        process.stderr.write('No such file or directory: ' + root + '\n');
        process.exit(1);
    }

    // blacklist / since readdirSyncRecursive fails on it
    if (_.contains(['/'], root)) {
        process.stderr.write('Illegal file or directory: ' + root + '\n');
        process.exit(1);
    }

    // stat root
    var stats = fs.statSync(root);

    // file
    if (stats.isFile()) {
        paths = _.union(paths, [root]);
    }

    // directory
    else if (stats.isDirectory()) {

        // recurse into root, prepending root, avoiding duplicates
        paths = _.union(paths, root, _.map(wrench.readdirSyncRecursive(root), function(descendant) {
            return path.join(root, descendant);
        }));

    }

});

// ensure a path exists
if (paths.length === 0) {
    process.stderr.write('Nothing to check.' + '\n');
    process.exit(1);
}

// sort paths so that parent directories are created before children
paths.sort();

// find paths' longest common prefix
// http://stackoverflow.com/questions/1916218/find-the-longest-common-starting-substring-in-a-set-of-strings/1917041#1917041
var prefix = new RegExp('^' + (function() {
    var first = path.join(path.dirname(paths[0]), '/');
    var length = first.length;
    var last = path.join(path.dirname(paths[paths.length - 1]), '/');
    while (length > 0 && last.indexOf(first) === -1) {
        first = first.substring(0, --length);
    }
    return first.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
})());

// create ZIP
var zip = new JSZip();

// iterate over paths
_.each(paths, function(p) {

    // trim prefix
    var suffix = p.replace(prefix, '');

    // ignore common parent
    if (suffix.length === 0) {
        return;
    }

    // add path to ZIP
    var stats = fs.statSync(p);
    if (stats.isDirectory()) {
        zip.folder(path.join(suffix, '/'));
    }
    else if (stats.isFile()) {
        try {
            if (argv.debug === false) {
                process.stdout.write('Compressing ' + suffix + '...');
            }
            zip.file(suffix, fs.readFileSync(p).toString());
            if (argv.debug === false) {
                process.stdout.write('\33[2K\r');
            }
        }
        catch (e) {
            switch (e.code) {

                case 'EACCES':
                    process.stderr.write(' Could not read file.\n');
                    break;

                default:
                    process.stderr.write(' ' + e.code + ' error.\n');
                    break;

            }
            process.exit(1);
        }
    }

});

// check!
async.waterfall([

    // POST /upload
    function(callback) {

        // upload ZIP
        if (argv.debug === false) {
            process.stdout.write('Uploading.');
        }
        var buffer = new Buffer(zip.generate({ base64: false, compression:'DEFLATE' }), 'binary');
        var interval = setInterval(function() {
            if (argv.debug === false) {
                process.stdout.write('.');
            }
        }, 500);

        request.post({
            body: buffer,
            headers: {
                'Content-Length': buffer.length,
                'Content-Type': 'application/zip',
                'Content-Transfer-Encoding': 'binary'
            },
            jar: true,
            uri: ENDPOINT + '/upload'
        }, function(err, response, body) {

            // handle response
            clearInterval(interval);
            if (err !== null) {
                return callback(err);
            }
            else if (response.statusCode === 503) {
                return callback(new Error('server is offline'));
            }

            // parse body
            try {
                var payload = JSON.parse(body);
            }
            catch (e) {
                return callback(e);
            }
            if (!_.isUndefined(payload.id)) {
                if (argv.debug === false) {
                    process.stdout.write('\33[2K\r');
                }
                return callback(null, payload.id);
            }
            else if (!_.isUndefined(payload.error)) {
                return callback(payload.error);
            }
            else {
                return callback(new Error('invalid response from server'));
            }
        });
    },

    // POST /check
    function(id, callback) {

        // run checks
        if (argv.debug === false) {
            process.stdout.write('Checking.');
        }

        var interval = setInterval(function() {
            if (argv.debug === false) {
                process.stdout.write('.');
            }
        }, 500);

        request.post({
            form: {
                checks: argv._[0],
                homedir: id
            },
            headers: {
                'Content-Type': 'application/json'
            },
            jar: true,
            uri: ENDPOINT + '/check'
        }, function(err, response, body) {

            // handle response
            clearInterval(interval);
            if (err !== null) {
                return callback(err);
            }
            else if (response.statusCode === 503) {
                return callback(new Error('server is offline'));
            }

            // parse body
            try {
                var payload = JSON.parse(body);
            }
            catch (e) {
                return callback(e);
            }
            if (!_.isUndefined(payload.error)) {
                return callback(payload.error);
            }
            else if (_.isUndefined(payload.id) || _.isUndefined(payload.results)) {
                return callback(new Error('invalid response from server'));
            }
            else {
                if (argv.debug === false) {
                    process.stdout.write('\33[2K\r');
                }
                return callback(null, payload.id, payload);
            }
        });

}], function(err, id, payload) {

    // report results
    if (err !== null) {
        if (typeof err.code === 'undefined' || err.code === 'E_USAGE') {
            var message = err.message;
        }
        else {
            switch (err.code) {
                case 'ECONNREFUSED':
                    var message = 'could not reach server.';
                    break;

                case 'ECONNRESET':
                    var message = 'connection to server died.';
                    break;

                default:
                    var message = err.code + ' error.';

            }
        }
        process.stderr.write(' ' + message + '\n');
        process.exit(1);
    }
    else {

        // -d, --debug
        if (argv.debug === true) {
            process.stdout.write(JSON.stringify(payload, undefined, '  '));
            process.exit(0);
        }

        // -c, --coupon
        else if (argv.coupon === true) {
            process.stdout.write(id + '\n');
            process.exit(0);
        }

        // iterate over checks
        for (check in payload.results) {

            // report passed check in green
            if (payload.results[check].result === true) {

                // :)
                process.stdout.write('\033[32m'); // green
                process.stdout.write(':) ' + payload.results[check].description + '\n');
                process.stdout.write('\033[39m'); // default

            }

            // report failed dependency in yellow
            else if (payload.results[check].result === null) {

                // :|
                process.stdout.write('\033[33m'); // yellow
                process.stdout.write(':| ' + payload.results[check].description + '\n');
                process.stdout.write('\033[39m'); // default
                process.stdout.write('   \\ can\'t check until a frown turns upside down\n');

            }

            // report failed check in red
            else {

                // :(
                process.stdout.write('\033[31m'); // red
                process.stdout.write(':( ' + payload.results[check].description + '\n');
                process.stdout.write('\033[39m'); // default

                // check for error
                if (!_.isUndefined(payload.results[check].error)) {
                    process.stdout.write('   \\ ' + payload.results[check].error + '\n');
                    continue;
                }

                // check for script
                if (_.isUndefined(payload.results[check].script)) {
                    continue;
                }

                // mismatch is always at end of script
                var mismatch = payload.results[check].script[payload.results[check].script.length - 1];

                // prepare substring of actual stderr or stdout
                var substring;
                if (!_.isUndefined(mismatch.actual)) {
                    if (mismatch.actual.type === 'stderr' || mismatch.actual.type === 'stdout') {
                        var string = JSON.stringify(mismatch.actual.value);
                        substring = string.substring(0, 40);
                        if (substring.length < string.length) {
                            substring += '..."';
                        }
                    }
                }

                // signal
                if (_.isUndefined(mismatch.expected)) {
                    if (mismatch.actual.type === 'signal' && mismatch.actual.value === 'SIGKILL') {
                        process.stdout.write('   \\ killed by server\n');
                    }
                }

                // diff
                else if (mismatch.expected.type === 'diff') {

                    // compare binary files
                    if (_.isArray(mismatch.actual.value)) {
                        if (mismatch.expected.value.length !== mismatch.actual.value.length) {
                            process.stdout.write('   \\ expected file to be of length ' + mismatch.expected.value.length + ', not ' + mismatch.actual.value.length + '\n');
                        }
                        else {
                            for (var i = 0, n = mismatch.expected.value.length; i < n; i++) {
                                if (mismatch.expected.value[i] !== mismatch.actual.value[i]) {
                                    process.stdout.write('   \\ expected 0x' + mismatch.expected.value[i].toString(16) + ' at byte ' + i + ', not 0x' + mismatch.actual.value[i].toString(16) + '\n');
                                    break;
                                }
                            }
                        }
                    }

                    // compare text files
                    else if (_.isString(mismatch.actual.value)) {
                        if (mismatch.expected.value.length !== mismatch.actual.value.length) {
                            process.stdout.write('   \\ expected file to be of length ' + mismatch.expected.value.length + ', not ' + mismatch.actual.value.length + '\n');
                        }
                        else {
                            for (var c = 1, i = 0, l = 1, n = mismatch.expected.value.length; i < n; i++) {
                                if (mismatch.expected.value.charAt(i) !== mismatch.actual.value.charAt(i)) {
                                    process.stdout.write('   \\ expected ' + JSON.stringify(mismatch.expected.value.charAt(i)) + ' character ' + c + ' of line ' + l + ', not ' + JSON.stringify(mismatch.actual.value.charAt(i)));
                                    break;
                                }
                                if (mismatch.expected.value.charAt(i) === '\n') {
                                    l++;
                                    c = 1;
                                }
                                else {
                                    c++;
                                }
                            }
                        }
                    }
                }

                // exists
                else if (mismatch.expected.type === 'exists') {
                    process.stdout.write('   \\ expected ' + mismatch.expected.value + ' to exist\n');
                }

                // exit
                else if (mismatch.expected.type === 'exit') {
                    process.stdout.write('   \\ expected an exit code of ' + mismatch.expected.value);
                    if (mismatch.actual.type === 'exit') {
                        process.stdout.write(', not ' + mismatch.actual.value);
                    }
                    else if (mismatch.actual.type === 'stderr') {
                        process.stdout.write(', not standard error of ' + substring);
                    }
                    else if (mismatch.actual.type === 'stdin') {
                        process.stdout.write(', not a prompt for input');
                    }
                    else if (mismatch.actual.type === 'stdout') {
                        process.stdout.write(', not output of ' + substring);
                    }
                    process.stdout.write('\n');
                }
                else if (mismatch.expected.type === 'stderr') {
                    process.stdout.write('   \\ expected standard error');
                    if (mismatch.actual.type === 'exit') {
                        process.stdout.write(', not an exit code of ' + mismatch.actual.value);
                    }
                    else if (mismatch.actual.type === 'stderr') {
                        process.stdout.write(', but not ' + substring);
                        if (mismatch.suggestions.length !== 0) {
                            process.stdout.write('\n   \\ Suggestions:\n   \\    ');
                            var suggestions = _.map(mismatch.suggestions, function(x) {
                                return x.replace(/\n/g, '\n   \\    ');
                            }).join('\n   \\    ');
                            process.stdout.write(suggestions);
                        }
                    }
                    else if (mismatch.actual.type === 'stdin') {
                        process.stdout.write(', not a prompt for input');
                    }
                    else if (mismatch.actual.type === 'stdout') {
                        process.stdout.write(', not output of ' + substring);
                    }
                    process.stdout.write('\n');
                }
                else if (mismatch.expected.type === 'stdin') {
                    process.stdout.write('   \\ expected prompt for input');
                    if (mismatch.actual.type === 'exit') {
                        process.stdout.write(', not exit code of ' + mismatch.actual.value);
                    }
                    else if (mismatch.actual.type === 'stderr') {
                        process.stdout.write(', not standard error of ' + substring);
                    }
                    else if (mismatch.actual.type === 'stdout') {
                        process.stdout.write(', not output of ' + substring);
                    }
                    process.stdout.write('\n');
                }
                else if (mismatch.expected.type === 'stdout') {
                    process.stdout.write('   \\ expected output');
                    if (mismatch.actual.type === 'exit') {
                        process.stdout.write(', not an exit code of ' + mismatch.actual.value);
                    }
                    else if (mismatch.actual.type === 'stdin') {
                        process.stdout.write(', not a prompt for input');
                    }
                    else if (mismatch.actual.type === 'stderr') {
                        process.stdout.write(', not standard error of ' + substring);
                    }
                    else if (mismatch.actual.type === 'stdout') {
                        process.stdout.write(', but not ' + substring);
                        if (mismatch.suggestions.length !== 0) {
                            process.stdout.write('\n   \\ Suggestions:\n   \\    ');
                            var suggestions = _.map(mismatch.suggestions, function(x) {
                                return x.replace(/\n/g, '\n   \\    ');
                            }).join('\n   \\    ');
                            process.stdout.write(suggestions);
                        }
                    }
                    process.stdout.write('\n');
                }
            }
        }

        // diagnostics
        var url = ENDPOINT + '/checks/' + id;
        process.stdout.write(url + '\n');

        // TODO
        // if (!_.isUndefined(process.env.DISPLAY)) {
        //     var child = child_process.spawn('google-chrome', ['--app=' + url]);
        //     child.unref();
        // }
    }

    // This was CS50 Check.
    process.exit(0);

});
