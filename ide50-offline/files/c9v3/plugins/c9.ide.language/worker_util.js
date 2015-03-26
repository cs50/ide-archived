/*
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
 
/**
 * Language handler utilities. These may only be used from within
 * a language handler, which runs in a web worker.
 * 
 * Import using
 * 
 *     require("plugins/c9.ide.language/worker_util")
 * 
 * See {@link language}
 * 
 * @class language.worker_util
 */
define(function(require, exports, module) {

var worker = require("./worker");
var completeUtil = require("./complete_util");

var msgId = 0;

module.exports = {

    /**
     * Utility function, used to determine whether a certain feature is enabled
     * in the user's preferences.
     * 
     * @param {String} name  The name of the feature, e.g. "unusedFunctionArgs"
     * @return {Boolean}
     */
    isFeatureEnabled: function(name) {
        /*global disabledFeatures*/
        return !disabledFeatures[name];
    },
    
    /**
     * Utility function, used to determine the identifier regex for the 
     * current language, by invoking {@link #getIdentifierRegex} on its handlers.
     * 
     * @param {Object} [offset] The position to determine the identifier regex of
     * @return {RegExp}
     */
    getIdentifierRegex: function(offset) {
        return worker.$lastWorker.getIdentifierRegex(offset);
    },
    
    /**
     * Utility function, used to retrigger completion,
     * in case new information was collected and should
     * be displayed, and assuming the popup is still open.
     * 
     * @param {Object} pos   The position to retrigger this update
     * @param {String} line  The line that this update was triggered for
     */
    completeUpdate: function(pos, line) {
        return worker.$lastWorker.completeUpdate(pos, line);
    },
    
    /**
     * Calls {@link proc#execFile} from the worker.
     * 
     * @param {String}   path                             the path to the file to execute
     * @param {Object}   [options]
     * @param {Array}    [options.args]                   An array of args to pass to the executable.
     * @param {String}   [options.stdoutEncoding="utf8"]  The encoding to use on the stdout stream. Defaults to .
     * @param {String}   [options.stderrEncoding="utf8"]  The encoding to use on the stderr stream. Defaults to "utf8".
     * @param {String}   [options.cwd]                    Current working directory of the child process
     * @param {Array}    [options.stdio]                  Child's stdio configuration. (See above)
     * @param {Object}   [options.env]                    Environment key-value pairs
     * @param {String}   [options.encoding="utf8"]        
     * @param {Number}   [options.timeout=0]         
     * @param {Number}   [options.maxBuffer=200*1024]
     * @param {String}   [options.killSignal="SIGTERM"]
     * @param {Boolean}  [options.resumeStdin]            Start reading from stdin, so the process doesn't exit
     * @param {Boolean}  [options.resolve]                Resolve the path to the VFS root before executing file
     * @param {Function} [callback]
     * @param {Error}    callback.error                   The error object if an error occurred.
     * @param {String}   callback.stdout                  The stdout buffer
     * @param {String}   callback.stderr                  The stderr buffer
     */
    execFile: function(path, options, callback) {
        var id = msgId++;
        worker.sender.emit("execFile", { path: path, options: options, id: id });
        worker.sender.on("execFileResult", function onExecFileResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("execFileResult", onExecFileResult);
            callback && callback(event.data.err, event.data.stdout, event.data.stderr);
        });
    },
    
    /**
     * Reads the entire contents from a file in the workspace,
     * using {@link fs#readFile}. May use a cached version if the file
     * is currently open in the IDE.
     * 
     * Example:
     * 
     *     worker_util.readFile('/config/server.js', function (err, data) {
     *         if (err) throw err;
     *         console.log(data);
     *     });
     *
     * @method
     * 
     * @param {String}   path               the path of the file to read
     * @param {Object}   [options]          options or encoding of this file
     * @param {String}   [options.encoding] the encoding of this file
     * @param {Boolean}  [options.allowUnsaved]
     *                                      whether to return unsaved changes
     * @param {Function} [callback]         called after the file is read
     * @param {Error}    callback.err       the error information returned by the operation
     * @param {String}   callback.data      the contents of the file that was read
     * @fires error
     * @fires downloadProgress
     */
    readFile: function(path, encoding, callback) {
        if (!callback) { // fix arguments
            callback = encoding;
            encoding = null;
        }
        
        if (worker.$lastWorker.$path === path) {
            callback && setTimeout(callback.bind(null, null, worker.$lastWorker.doc.getValue()), 0);
            return;
        }
        
        if (path.match(/\/$/) || path === ".") { // fail fast
            var err = new Error("File is a directory");
            err.code = "EISDIR";
            return callback(err);
        }
        
        var id = msgId++;
        worker.sender.on("readFileResult", function onReadFileResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("readFileResult", onReadFileResult);
            callback && callback(event.data.err && JSON.parse(event.data.err), event.data.data);
        });
        worker.sender.emit("readFile", { path: path, encoding: encoding, id: id });
    },
    
    /**
     * Loads the stat information for a single path entity.
     *
     * @param {String}   path      the path of the file or directory to stat
     * @param {Function} callback  called after the information is retrieved
     * @param {Error}    callback.err  
     * @param {Object}   callback.data 
     * @param {String}   callback.data.name      The basename of the file path (eg: file.txt).
     * @param {Number}   callback.data.size      The size of the entity in bytes.
     * @param {Number}   callback.data.mtime     The mtime of the file in ms since epoch.
     * @param {Number}   callback.data.mime      The mime type of the entity. 
     *   Directories will have a mime that matches /(folder|directory)$/. 
     *   This implementation will give inode/directory for directories.
     * @param {String}   callback.data.link      If the file is a symlink, 
     *   this property will contain the link data as a string.
     * @param {Object}   callback.data.linkStat  The stat information 
     *   for what the link points to.
     * @param {String}   callback.data.fullPath  The linkStat object 
     *   will have an additional property that's the resolved path relative to the root.
     * @fires error
     */
   stat: function(path, callback) {
        var id = msgId++;
        worker.sender.on("statResult", function onReadFileResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("statResult", onReadFileResult);
            callback && callback(event.data.err && JSON.parse(event.data.err), event.data.data);
        });
        worker.sender.emit("stat", { path: path, id: id });
    },

    /**
     * Show an error popup in the IDE.
     * @param {String} message
     * @param {Number} [timeout]
     */
    showError: function(message, timeout) {
        if (message.stack) {
            // Can't pass error object to UI
            console.error(message.stack);
            message = message.message;
        }
        worker.sender.emit("showError", { message: message, timeout: timeout });
    },
    
    /**
     * @ignore
     */
    asyncForEach: function(array, fn, callback) {
        worker.asyncForEach(array, fn, callback);
    },
    
    /**
     * Get a list of the current open files.
     * 
     * @return {String[]}
     */
    getOpenFiles: function() {
        var results = [];
        var set = worker.$lastWorker.$openDocuments;
        Object.keys(set).forEach(function(e) {
            results.push(set[e]);
        });
        return results;
    },
    
    
    /**
     * Refresh all language markers in open editors.
     */
    refreshAllMarkers: function() {
        worker.sender.emit("refreshAllMarkers");
    },
    
    /**
     * Gets the identifier string preceding the current position.
     * 
     * @param {String} line     The line to search in
     * @param {Number} offset   The offset to start
     * @param {RegExp} [regex]  The regular expression to use
     * @return {String}
     */
    getPrecedingIdentifier: function(line, offset, regex) {
        regex = regex || this.getIdentifierRegex(offset);
        return completeUtil.retrievePrecedingIdentifier(line, offset, regex);
    },
    
    /**
     * Retrieves the identifier string following the current position.
     * 
     * @param {String} line     The line to search in
     * @param {Number} offset   The offset to start
     * @param {RegExp} [regex]  The regular expression to use
     * @return {String}
     */
    getFollowingIdentifier: function(line, offset, regex) {
        regex = regex || this.getIdentifierRegex(offset);
        return completeUtil.retrieveFollowingIdentifier(line, offset, regex);
    },
    
    /**
     * Retrieves the identifier string at the current position.
     * 
     * @param {String} line     The line to search in
     * @param {Number} offset   The offset to start
     * @param {RegExp} [regex]  The regular expression to use
     * @return {String}
     */
    getIdentifier: function(line, offset, regex) {
        regex = regex || this.getIdentifierRegex(offset);
        return this.getPrecedingIdentifier(line, offset, regex)
            + this.getFollowingIdentifier(line, offset, regex);
    },
    
    /**
     * Gets all (matching) tokens for the current file.
     *
     * @param {Document} doc              The current document
     * @param {String[]} identifiers      If not null, only return tokens equal to one of these strings
     * @param {Function} callback
     * @param {String} callback.err
     * @param {Object[]} callback.result
     */
    getTokens: function(doc, identifiers, callback) {
        var id = msgId++;
        worker.sender.emit("getTokens", {
            path: worker.$lastWorker.$path,
            identifiers: identifiers,
            id: id,
            region: doc.region
        });
        worker.sender.on("getTokensResult", function onResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("getTokensResult", onResult);
            callback(event.data.err, event.data.results);
        });
    },
    
    /**
     * Watch a directory for changes.
     * @internal
     * @ignore
     */
    $watchDir: function(path, plugin) {
        worker.sender.emit("watchDir", { path: path });
    },
    
    /**
     * Unwatch a directory watched for changes.
     * @internal
     * @ignore
     */
    $unwatchDir: function(path, plugin) {
        worker.sender.emit("watchDir", { path: path });
    },
    
    /**
     * Get notified when a watched directory changes.
     * @internal
     * @ignore
     */
    $onWatchDirChange: function(listener) {
        worker.sender.on("watchDirResult", listener);
    }
};

});