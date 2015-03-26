define(function(require, exports, module) {
    main.consumes = [
        "MountTab", "ui", "proc", "c9", "fs", "mount"
    ];
    main.provides = ["mount.sftp"];
    return main;

    function main(options, imports, register) {
        var MountTab = imports.MountTab;
        var ui = imports.ui;
        var proc = imports.proc;
        var c9 = imports.c9;
        var fs = imports.fs;
        var mnt = imports.mount;
        
        var SFTPFS = options.sshfsBin || "sshfs";
        var FUSERMOUNT = options.fusermountBin || "fusermount";
        
        /***** Initialization *****/
        
        var plugin = new MountTab("Ajax.org", main.consumes, { 
            caption: "SFTP", 
            name: "sftp", 
            index: 200 
        });
        // var emit = plugin.getEmitter();
        
        var tbSFTPHost, tbSFTPPort, tbSFTPMountPoint, tbSFTPUser, tbSFTPPass;
        var tbSFTPRemote;
        var activeProcess, cancelled;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
        }
        
        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;
            
            ui.insertMarkup(options.aml, require("text!./sftp.xml"), plugin);
            
            tbSFTPHost = plugin.getElement("tbSFTPHost");
            tbSFTPPort = plugin.getElement("tbSFTPPort");
            tbSFTPMountPoint = plugin.getElement("tbSFTPMountPoint");
            tbSFTPUser = plugin.getElement("tbSFTPUser");
            tbSFTPPass = plugin.getElement("tbSFTPPass");
            tbSFTPRemote = plugin.getElement("tbSFTPRemote");
        }
        
        /***** Methods *****/
        
        function validate(){
            if (!tbSFTPMountPoint.getValue()) 
                return mnt.error({ caption: "Please enter a mount name" });
            if (!tbSFTPHost.getValue())
                return mnt.error({ caption: "Please enter a host or ip address" });
            if (!tbSFTPPort.getValue()) 
                return mnt.error({ caption: "Please enter a port" });
            if (!tbSFTPUser.getValue()) 
                return mnt.error({ caption: "Please enter a username" });
            if (!tbSFTPRemote.getValue()) 
                return mnt.error({ caption: "Please enter the remote dir" });
            return true;
        }
        
        function verify(path, callback, retries){
            path = path.replace(/^~/, c9.home);
            if (!retries) retries = 0;
            
            proc.execFile("mount", {}, function(err, stdout, stderr){
                if (!err && stdout.indexOf(path) == -1) {
                    if (++retries < 10)
                        return setTimeout(verify.bind(null, path, callback, retries), 100);
                    
                    err = new Error("Mount is not found: " + path);
                }
                callback(err);
            });
        }
        
        function mount(args, callback){
            if (args.fromUI) {
                var name = tbSFTPMountPoint.getValue().trim() 
                    || tbSFTPHost.getValue().trim();
                    
                args = {
                    user: tbSFTPUser.getValue().trim(),
                    host: tbSFTPHost.getValue().trim(),
                    remote: tbSFTPRemote.getValue().trim(),
                    mountpoint: "~/mounts/" + name,
                    password: tbSFTPPass.getValue().trim(),
                    port: tbSFTPPort.getValue().trim()
                };
            }
            
            //Encode "@" as curlftpfs doesn't likes it raw.
            args.password = args.password.replace(/@/g, "%40");
            args.user = args.user.replace(/@/g, "%40");
            
            // Reset cancelled state
            cancelled = false;
            
            var host = args.user + "@" + args.host + ":" + args.remote;
            var mountpoint = args.mountpoint;
            
            mnt.progress({ caption: "Unmounting..." });
            unmount({ path: mountpoint }, function(err){
                
                if (cancelled) return callback(mnt.CANCELERROR);
                
                mnt.progress({ caption: "Checking Mount Point..." });
                fs.mkdirP(mountpoint, function(err){ // mkdirP doesn't error when dir already exists
                    if (cancelled) return callback(mnt.CANCELERROR);
                    if (err) return callback(err);
                    
                    var fuseOptions = [
                        "auto_cache", 
                        "transform_symlinks", 
                        "StrictHostKeyChecking=no",
                        // Experiment to address SSHFS disconnect issue
                        // See https://github.com/c9/newclient/issues/4752#issuecomment-59135843
                        "reconnect",
                        "workaround=all"
                    ]; //"direct_io" "allow_other", 
                    
                    // if (c9.platform == "linux")
                    //     fuseOptions.push("nonempty");
                    if (args.password)
                        fuseOptions.push("password_stdin");
                    else
                        fuseOptions.push("PasswordAuthentication=no");
                    
                    mnt.progress({ caption: "Mounting..." });
                    proc.spawn(SFTPFS, {
                        args: [
                            host, 
                            mountpoint.replace(/^~/, c9.home),
                            "-o", fuseOptions.join(","),
                            "-p", args.port,
                            "-C"
                        ]
                    }, function(err, child){
                        if (err) return callback(err);
                        
                        activeProcess = [child, mountpoint];
                        
                        if (args.password)
                            child.stdin.write(args.password + "\n");
                        child.stdin.end();
                        
                        var data = "";
                        child.stdout.on("data", function(chunk){
                            if (chunk.match(/yes\/no/))
                                child.stdin.write("yes\n");
                            else 
                                data += chunk;
                        });
                        child.stderr.on("data", function(chunk){
                            if (chunk.match(/yes\/no/))
                                child.stdin.write("yes\n");
                            else 
                                data += chunk;
                        });
                        child.on("exit", function(){
                            var err;
                            
                            activeProcess = [null, mountpoint];
                            
                            if (data.indexOf("execvp()") > -1) {
                                err = new Error("sshfs");
                                err.code = "EINSTALL";
                            }
                            else if (data.indexOf("No such file or directory") > -1)
                                err = new Error("Invalid Directory: " + args.remote);
                            else if (data)
                                err = new Error(data);
                            
                            if (err)
                                return callback(err);
                            
                            mnt.progress({ caption: "Verifying..." });
                            verify(mountpoint, function(err){
                                activeProcess = null;
                                
                                if (cancelled)
                                    return callback(mnt.CANCELERROR);
                                
                                if (err)
                                    return callback(err);
                                
                                callback(null, {
                                    path: mountpoint,
                                    name: "sftp://" + host,
                                    type: "sftp",
                                    args: args
                                });
                            })
                        });
                    });
                });
            })
        }
        
        function unmount(options, callback){
            var PROC = c9.platform == "linux" ? FUSERMOUNT : "umount";
            var path = options.path.replace(/^~/, c9.home);
            proc.execFile(PROC, { args: ["-u", "-z", path] }, function(err, stdout, stderr){
                if ((err || stderr) && c9.platform == "darwin") {
                    proc.execFile("diskutil", {
                        args: ["unmount", "force", path]
                    }, callback);
                }
                else callback(err);
            });
        }
        
        function cancel(){
            if (!activeProcess)
                return;
            
            cancelled = true;
            
            var process = activeProcess[0];
            if (process) {
                process.on("exit", function(){
                    unmount({ path: activeProcess[1] }, function(){});
                });
                activeProcess[0].kill();
            }
            else {
                unmount({ path: activeProcess[1] }, function(){});
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("draw", function(e){
            draw(e);
        });
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            validate: validate,
            
            /**
             * 
             */
            verify: verify,
            
            /**
             * 
             */
            cancel: cancel,
            
            /**
             * 
             */
            mount: mount,
            
            /**
             * 
             */
            unmount: unmount
        });
        
        register(null, {
            "mount.sftp": plugin
        });
    }
});