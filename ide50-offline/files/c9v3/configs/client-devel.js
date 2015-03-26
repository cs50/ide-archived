var assert = require("assert");
module.exports = function(options) {
    assert(options.staticPrefix, "Option 'staticPrefix' must be set");
    assert(options.projectUrl, "Option 'projectUrl' must be set");
    assert(options.homeUrl, "Option 'homeUrl' must be set");
    assert(options.workspaceDir, "Option 'workspaceDir' must be set");
    assert(options.workspaceId, "Option 'workspaceId' must be set");
    assert(options.workspaceName, "Option 'workspaceName' must be set");
    assert(options.home, "Option 'home' must be set");
    assert(options.platform, "Option 'platform' must be set");
    assert(options.tmux, "Option 'tmux' must be set");
    
    var workspaceDir = options.workspaceDir;
    var debug = options.debug !== undefined ? options.debug : true;
    var staticPrefix = options.staticPrefix;
    
    
    var nodeBin = options.nodeBin || "node";
    var nodePath = options.nodePath || "";
    var runners = options.runners || {};
    var builders = options.builders || {};
    
    return [
        // C9
        {
            packagePath: "plugins/c9.core/c9",
            
            startdate: new Date(),
            version: "3.0 Alpha 1",
            debug: debug,
            workspaceId: options.workspaceId, //"user/javruben/dev"
            name: options.workspaceName,
            readonly: false,
            staticUrl: staticPrefix,
            hosted: !options.local && !options.dev,
            local: options.local,
            env: options.env || "devel",
            home: options.home,
            platform: options.platform,
            installed: options.installed,
            projectName: options.projectName || "Project"
        },
        {
            packagePath: "plugins/c9.core/settings",
            settings: ""
        },
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        
        // Logging, Metrics, Monitoring, Testing
        {
            packagePath: "plugins/c9.ide.log/log",
            origin: "development-web"
        },
        "plugins/c9.ide.log/duration",

        // VFS
        {
            packagePath: "plugins/c9.vfs.client/vfs_client",
            smithIo: options.smithIo,
            debug: debug
        },
        {
            packagePath: "plugins/c9.vfs.client/endpoint",
            readonly: false,
            region: options.region,
            pid: options.project.pid,
            servers: options.vfsServers
        },
        {
            packagePath: "plugins/c9.ide.auth/auth",
            accessToken: options.accessToken || ""
        },
        {
            packagePath: "plugins/c9.core/api",
            apiUrl: options.apiUrl
        },
        
        // Editors
        "plugins/c9.ide.editors/document",
        {
            packagePath: "plugins/c9.ide.editors/editors",
            defaultEditor: "ace"
        },
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/imgview",
        "plugins/c9.ide.editors/urlview",
        {
            packagePath: "plugins/c9.ide.editors/tabmanager",
            loadFilesAtInit: false
        },
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.editors/metadata",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/undomanager",
        
        // "plugins/c9.ide.newresource/newresource",
        // "plugins/c9.ide.undo/undo",
        // "plugins/c9.ide.closeconfirmation/closeconfirmation",
        // {
        //     packagePath: "plugins/c9.ide.openfiles/openfiles",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.layout.classic"
        // },

        "plugins/c9.ide.notifications/notifications",
        // Collab
        {
            packagePath: "plugins/c9.ide.collab/connect",
            enable: true,
            DEBUG: 1,
            nodeBin: nodeBin,
            nodePath: nodePath,
            basePath: workspaceDir
        },
        "plugins/c9.ide.collab/collab",
        "plugins/c9.ide.collab/collabpanel",
        "plugins/c9.ide.collab/share/share",
        "plugins/c9.ide.collab/workspace",
        "plugins/c9.ide.collab/util",
        {
            packagePath: "plugins/c9.ide.collab/ot/document",
            minDelay: 500,
            maxDelay: 10000
        },
        {
            packagePath: "plugins/c9.ide.collab/cursor_layer",
            staticPrefix: staticPrefix + "/plugins/c9.ide.collab"
        },
        "plugins/c9.ide.collab/author_layer",
        {
            packagePath: "plugins/c9.ide.collab/timeslider/timeslider",
            staticPrefix: staticPrefix + "/plugins/c9.ide.collab/timeslider"
        },
        {
            packagePath: "plugins/c9.ide.collab/chat/chat",
            staticPrefix: staticPrefix + "/plugins/c9.ide.collab/chat"
        },
        "plugins/c9.ide.collab/members/members_panel",
        {
            packagePath: "plugins/c9.ide.collab/members/members",
            staticPrefix: staticPrefix + "/plugins/c9.ide.collab/members"
        },
        
        // Ace && Commands
        "plugins/c9.ide.keys/commands",
        "plugins/c9.ide.keys/editor",
        {
            packagePath: "plugins/c9.ide.ace/ace",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.ace.stripws/stripws",
        "plugins/c9.ide.ace.repl/editor",
        {
            packagePath: "plugins/c9.ide.ace.gotoline/gotoline",
            staticPrefix: staticPrefix + "/plugins/c9.ide.ace.gotoline"
        },
        {
            packagePath: "plugins/c9.ide.ace.statusbar/statusbar",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        
        // Find
        {
            packagePath: "plugins/c9.ide.find/find",
            basePath: workspaceDir
        },
        {
            packagePath: "plugins/c9.ide.find/find.nak",
            ignore: "",
            basePath: workspaceDir,
            nak: options.nakBin || "~/.c9/node_modules/nak/bin/nak",
            node: options.nodeBin
        },
        // {
        //     packagePath  : "plugins/c9.ide.find.infiles/findinfiles",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.find.infiles"
        // },
        // {
        //     packagePath : "plugins/c9.ide.find.replace/findreplace",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.find.replace"
        // },
        
        // UI
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: staticPrefix + "/plugins/c9.ide.ui"
        },
        "plugins/c9.ide.ui/anims",
        "plugins/c9.ide.ui/tooltip",
        "plugins/c9.ide.ui/menus",
        "plugins/c9.ide.ui/forms",
        "plugins/c9.ide.ui/lib_apf",
        
        "plugins/c9.ide.dialog/dialog",
        "plugins/c9.ide.dialog.common/alert",
        "plugins/c9.ide.dialog.common/confirm",
        "plugins/c9.ide.dialog.common/filechange",
        "plugins/c9.ide.dialog.common/fileoverwrite",
        "plugins/c9.ide.dialog.common/fileremove",
        "plugins/c9.ide.dialog.common/question",
        "plugins/c9.ide.dialog.file/filesave",
        
        // VFS
        "plugins/c9.fs/proc",
        "plugins/c9.fs/proc.apigen",
        "plugins/c9.fs/net",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: workspaceDir
        },
        "plugins/c9.fs/fs.errors",
        "plugins/c9.fs/fs.cache.xml",
        
        // Watcher
        "plugins/c9.ide.threewaymerge/threewaymerge",
        "plugins/c9.ide.watcher/watcher",
        "plugins/c9.ide.watcher/gui",
        
        // Language
        // {
        //     packagePath: "plugins/c9.ide.language/language",
        //     workspaceDir: workspaceDir
        // },
        // "plugins/c9.ide.language/keyhandler",
        // "plugins/c9.ide.language/complete",
        // "plugins/c9.ide.language/marker",
        // "plugins/c9.ide.language/tooltip",
        // "plugins/c9.ide.language/jumptodef",
        // "plugins/c9.ide.language.generic/generic",
        // "plugins/c9.ide.language.javascript/javascript",
        // "plugins/c9.ide.language.javascript.infer/jsinfer",
        
        // Run
        {
            packagePath: "plugins/c9.ide.run/run",
            base: workspaceDir,
            tmux: options.tmux,
            runners: runners
        },
        {
            packagePath: "plugins/c9.ide.run/gui",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        {
            packagePath: "plugins/c9.ide.run.build/build",
            base: workspaceDir,
            builders: builders
        },
        {
            packagePath: "plugins/c9.ide.run.build/gui"
        },
        "plugins/c9.ide.run.debug/debuggers/sourcemap",
        {
            packagePath: "plugins/c9.ide.run.debug/debuggers/debugger",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        {
            packagePath: "plugins/c9.ide.run.debug/debuggers/v8/v8debugger",
            basePath: workspaceDir
        },
        {
            packagePath: "plugins/c9.ide.run.debug/debuggers/gdb/gdbdebugger",
            basePath: workspaceDir
        },
        "plugins/c9.ide.run.debug/breakpoints",
        "plugins/c9.ide.run.debug/debugpanel",
        "plugins/c9.ide.run.debug/callstack",
        {
            packagePath: "plugins/c9.ide.immediate/immediate",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.immediate/evaluator",
        "plugins/c9.ide.immediate/evaluators/browserjs",
        "plugins/c9.ide.run.debug/variables",
        "plugins/c9.ide.run.debug/watches",
        //"plugins/c9.ide.run.debug/quickwatch",
        
        // Console
        {
            packagePath: "plugins/c9.ide.terminal/terminal",
            tmux: options.tmux,
            root: workspaceDir,
            tmpdir: options.tmpdir,
            shell: options.shell || ""
        },
        {
            packagePath: "plugins/c9.ide.run/output",
            tmux: options.tmux
        },
        "plugins/c9.ide.console/console",
        
        // Layout & Panels
        {
            packagePath: "plugins/c9.ide.layout.classic/layout",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.tree/tree",
        // "plugins/c9.ide.upload/dragdrop",
        // {
        //     packagePath: "plugins/c9.ide.upload/upload",
        //     staticPrefix: "pluginstaticPrefix + s//c9.ide.upload"
        // },
        // {
        //     packagePath: "plugins/c9.ide.upload/upload_manager",
        //     workerPrefix: "plugins/c9.ide.upload",
        //     filesPrefix: options.projectUrl
        // },
        // {
        //     packagePath: "plugins/c9.ide.upload/upload_progress",
        //     staticPrefix: "pluginstaticPrefix + s//c9.ide.layout.classic"
        // },        
        // "plugins/c9.ide.dashboard/dashboard",
        "plugins/c9.ide.navigate/navigate",
        // {
        //     packagePath : "plugins/c9.ide.language/outline",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.language"
        // },
        {
            packagePath: "plugins/c9.ide.panels/panels",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic",
            defaultActiveLeft: "tree"
        },
        "plugins/c9.ide.panels/panel",
        "plugins/c9.ide.panels/area",
        
        // Deploy
        // {
        //     packagePath : "plugins/c9.ide.deploy/deploy",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.deploy"
        // },
        // "plugins/c9.ide.deploy/instance",
        // "plugins/c9.ide.deploy/target",
        // {
        //     packagePath : "plugins/c9.ide.deploy.mongolab/mongolab",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.deploy.mongolab/images"
        // },
        // {
        //     packagePath : "plugins/c9.ide.deploy.heroku/heroku",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.deploy.heroku/images"
        // },
        // {
        //     packagePath : "plugins/c9.ide.deploy.heroku/libheroku",
        //     basePath : workspaceDir,
        //     heroku : options.heroku,
        //     git : options.git
        // },
        // {
        //     packagePath : "plugins/c9.ide.deploy.openshift/openshift",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.deploy.openshift/images",
        //     rhc : options.rhc
        // },
        // {
        //     packagePath : "plugins/c9.ide.deploy.openshift/libopenshift",
        //     basePath : workspaceDir,
        //     git : options.git,
        //     rhc : options.rhc
        // },
        // {
        //     packagePath : "plugins/c9.ide.deploy.gae/gae",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.deploy.gae/images"
        // },
        // {
        //     packagePath : "plugins/c9.ide.deploy.gae/libgae",
        //     basePath : workspaceDir,
        //     git : options.git,
        // },
        
        // Previewer
        // {
        //     packagePath : "plugins/c9.ide.preview/preview",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.preview",
        //     defaultPreviewer : "preview.raw"
        // },
        // "plugins/c9.ide.preview.browser/browser",
        // "plugins/c9.ide.preview.raw/raw",
        // {
        //     packagePath: "plugins/c9.ide.preview.markdown/markdown",
        //     htmlurl: ""
        // },
        // {
        //     packagePath : "plugins/saucelabs.preview/preview",
        //     staticPrefix : staticPrefix + "/plugins/saucelabs.preview"
        // },
        
        // Other
        "plugins/c9.ide.info/info",
        // {
        //     packagePath: "plugins/c9.cli.bridge/bridge",
        //     port: 17123
        // },
        // {
        //     packagePath : "plugins/c9.cli.bridge/bridge_commands",
        //     basePath    : workspaceDir
        // },
        // {
        //     packagePath : "plugins/c9.ide.help/help",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.help"
        // },
        {
            packagePath: "plugins/c9.ide.feedback/feedback",
            staticPrefix: staticPrefix + "/plugins/c9.ide.feedback"
        },
        "plugins/c9.ide.save/save",
        "plugins/c9.ide.save/autosave",
        "plugins/c9.ide.clipboard/clipboard",
        "plugins/c9.ide.clipboard/html5",
        "plugins/c9.ide.behaviors/tabs",
        // {
        //     packagePath: "plugins/c9.ide.behaviors/dashboard",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.behaviors"
        // },
        {
            packagePath: "plugins/c9.ide.behaviors/page",
            staticPrefix: staticPrefix + "/plugins/c9.ide.behaviors"
        },
        "plugins/c9.ide.browsersupport/browsersupport",
        {
            packagePath: "plugins/c9.ide.preferences/preferences",
            staticPrefix: staticPrefix + "/plugins/c9.ide.preferences"
        },
        "plugins/c9.ide.preferences/preferencepanel",
        "plugins/c9.ide.preferences/general",
        "plugins/c9.ide.preferences/project"
    ];

};
