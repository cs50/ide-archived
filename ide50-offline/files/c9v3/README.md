Cloud9 3.0
============

The new VFS based Cloud9 with a focus on Stability, Performance and UX.

#### Documentation ####

Find the documentation at https://docs.c9.io/api.

#### Installation ####

Installing c9v3 is super simple.

    git clone git@github.com:c9/c9v3.git
    cd c9v3
    npm install

Installing depencies is easy as well.

    curl https://raw.github.com/c9/install/master/install.sh | bash

#### Starting the VFS server ####

    ./server.js

The following options can be used:

    -t          Start in Testing Mode
    -b          Listen for bridge commands
    -d          Start in Debug Mode
    -k          Don't kill tmux at startup (only relevant when -t is set)
    -w [path]   Use [path] as workspace root dir. Defaults to root dir of project.
    -p [port]   Set the port to [port]. Defaults to 8181.
    -l [host]   Set the host to [host]. Defaults to 0.0.0.0.

#### Documentation ####

Find the documentation at [http://docs.c9.io:8080/](http://docs.c9.io:8080/).

The docs are protected by a username and password which we will give out on request.

#### Load full UI in the browser ####

[http://localhost:8181/ide.html](http://localhost:8181/ide.html)

The plugin configuration for development mode is in configs/client-default.js.

*[This is currently broken]*
To start the full UI in development mode use the following url:

[http://localhost:8181/ide.html?devel=1](http://localhost:8181/ide.html?devel=1)

The plugin configuration for development mode is in configs/client-devel.js.

#### Running Tests ####

In the following example the server name is localhost. Change this to your server name or ip address.

Running all tests:

[http://localhost:8181/static/test.html](http://localhost:8181/static/test.html)

Running one specific test (in this case of the ace plugin):

[http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js](http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js)

Running multiple tests:

[http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js&plugins/c9.ace.gotoline/gotoline_test.js](http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js&plugins/c9.ace.gotoline/gotoline_test.js)

Keeping the UI after the test ran

[http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js&remain=1](http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js&remain=1)

#### Committing back to SubTree repositories

c9v3 uses git subtree as a way to manage the underlying repositories that are managed by us. 
To commit back to those repositories keep in mind that commits should not cross repository boundaries. 
Split up your commits per sub repo. The sub repos are all in the node_modules folder.

To pull from a repo use the following command:

    git fetch <name> master
    git subtree pull --prefix node_modules/<name> <name> master --squash


To push back to a repo use the following command:

    git subtree push --prefix=node_modules/<name> <name> <branch_name>

For instance:

    git subtree push --prefix=node_modules/ace ace fix/multi-cursor-weirdness

For more info see: [http://blogs.atlassian.com/2013/05/alternatives-to-git-submodule-git-subtree/](http://blogs.atlassian.com/2013/05/alternatives-to-git-submodule-git-subtree/)

#### Installing a new version of git using nix

Older versions of git don't have the subtree command. You can use nix to install the latest version of git:

    scripts/install-git-subtree.sh

