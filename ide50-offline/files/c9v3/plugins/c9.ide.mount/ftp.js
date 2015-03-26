define(function(require, exports, module) {
    main.consumes = [
        "MountTab", "ui", "proc", "c9", "mount", "fs"
    ];
    main.provides = ["mount.ftp"];
    return main;

    function main(options, imports, register) {
        var MountTab = imports.MountTab;
        var ui = imports.ui;
        var proc = imports.proc;
        var c9 = imports.c9;
        var fs = imports.fs;
        var mnt = imports.mount;
        
        var FTPFS = options.curlftpfsBin || "curlftpfs";
        var FUSERMOUNT = options.fusermountBin || "fusermount";
        
        /***** Initialization *****/
        
        var plugin = new MountTab("Ajax.org", main.consumes, { 
            caption: "FTP", 
            name: "ftp", 
            index: 100
        });
        // var emit = plugin.getEmitter();
        
        var tbFTPHost, tbFTPPort, tbFTPMountPoint, tbFTPUser, tbFTPPass;
        var tbFTPRemote;
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
            
            ui.insertMarkup(options.aml, require("text!./ftp.xml"), plugin);
            
            tbFTPHost = plugin.getElement("tbFTPHost");
            tbFTPPort = plugin.getElement("tbFTPPort");
            tbFTPMountPoint = plugin.getElement("tbFTPMountPoint");
            tbFTPUser = plugin.getElement("tbFTPUser");
            tbFTPPass = plugin.getElement("tbFTPPass");
            tbFTPRemote = plugin.getElement("tbFTPRemote");
        }
        
        /***** Methods *****/
        
        function validate(){
            if (!tbFTPMountPoint.getValue())
                return mnt.error({ caption: "Please enter a mount name" });
            if (!tbFTPHost.getValue()) 
                return mnt.error({ caption: "Please enter a host or ip address" });
            if (!tbFTPPort.getValue())
                return mnt.error({ caption: "Please enter a port" });
            if (!tbFTPUser.getValue())
                return mnt.error({ caption: "Please enter the username" });
            if (!tbFTPPass.getValue())
                return mnt.error({ caption: "Please enter the password" });
            if (!tbFTPRemote.getValue())
                return mnt.error({ caption: "Please enter the remote dir" });
            return true;
        }
        
        function verify(path, callback, retries){
            path = path.replace(/^~/, c9.home);
            if (!retries) retries = 0;
            
            proc.execFile("mount", {}, function(err, stdout, stderr){
                if (!err && stdout.indexOf(path) == -1) {
                    if (retries != -1 && ++retries < 10)
                        return setTimeout(verify.bind(null, path, callback, retries), 100);
                    
                    err = new Error("Mount is not found: " + path);
                }
                callback(err);
            });
        }
        
        function mount(args, callback){
            if (args.fromUI) {
                var name = tbFTPMountPoint.getValue().trim()
                    || tbFTPHost.getValue().trim();
                
                args = {
                    user: tbFTPUser.getValue().trim(),
                    pass: tbFTPPass.getValue().trim(),
                    host: tbFTPHost.getValue().trim(),
                    remote: tbFTPRemote.getValue().trim(),
                    mountpoint: "~/mounts/" + name,
                    port: tbFTPPort.getValue().trim()
                };
            }
            
            //Encode "@" as curlftpfs doesn't likes it raw.
            args.pass = args.pass.replace(/@/g, "%40");
            args.user = args.user.replace(/@/g, "%40");
            
            // Reset cancelled state
            cancelled = false;
            
            var host = "ftp://" + args.user + ":" + args.pass 
                + "@" + args.host + (args.port ? ":" + args.port : "")
                + args.remote;
            var mountpoint = args.mountpoint;
            
            mnt.progress({ caption: "Unmounting..." });
            unmount({ path: mountpoint }, function(err){
                
                if (cancelled) return callback(mnt.CANCELERROR);
                
                mnt.progress({ caption: "Checking Mount Point..." });
                fs.mkdirP(mountpoint, function(err){ // mkdirP doesn't error when dir already exists
                    if (cancelled) return callback(mnt.CANCELERROR);
                    if (err) return callback(err);
                    
                    var fuseOptions = ["auto_cache", "transform_symlinks"]; //"direct_io" "allow_other", 
                    // if (c9.platform == "linux")
                    //     fuseOptions.push("nonempty");
                    
                    mnt.progress({ caption: "Mounting..." });
                    proc.spawn(FTPFS, {
                        args: [
                            host, 
                            mountpoint.replace(/^~/, c9.home),
                            "-o", fuseOptions.join(",")
                        ]
                    }, function(err, child){
                        if (err) return callback(err);
                        
                        activeProcess = [child, mountpoint];
                        
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
                                err = new Error("curlftpfs");
                                err.code = "EINSTALL";
                            }
                            else if (data.indexOf("No such file or directory") > -1)
                                err = new Error("Invalid Directory: " + args.remote);
                            
                            else if (data.indexOf("Access denied") > -1) {
                                err = new Error("Authentication Failed : " + data);
                                err.code = "EACCESS";
                            }
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
                                    name: "ftp://" + host.replace(/^.*@/, ""),
                                    type: "ftp",
                                    args: args
                                });
                            });
                        });
                    });
                });
            });
        }
        
        // "hard_remove"
        function unmount(options, callback){
            var PROC = c9.platform == "linux" ? FUSERMOUNT : "umount";
            var path = options.path.replace(/^~/, c9.home);
            proc.execFile(PROC, { args: ["-u", "-z", path] }, callback);
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
            "mount.ftp": plugin
        });
    }
});