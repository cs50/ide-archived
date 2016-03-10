# ide50-docker
IDE50's Docker configuration for Cloud9

Since Docker containers are built incrementally, building an offline container
requires first creating an underlying <tt>workspace</tt> image, then building
an <tt>ide50</tt> image on top of that, and then finally creating the
<tt>ide50-offline</tt> image on top. There are some `make` commands to
simplify this process.

# Making changes to offline:

The primary way to make changes to the offline workspace is to add things
(required packages, scripting various installation steps, etc) to the [ide50
Debian package](https://github.com/cs50/ide50) which is also used for the
online version of the IDE. The build process below builds an offline IDE
based on the publicly-accessible IDE50 package on mirror.cs50.net.

# Testing offline changes:

First build an offline workspace from scratch using the "To build all from
scratch" steps below.

Next, make changes to the [ide50 Debian package](https://github.com/cs50/ide50),
build it, and follow the directions on that repo to locally install the deb
on the offline workspace (also be sure to test it on an online workspace!)
you generated above.

If all goes well, publish the deb to the mirror and build the offline
workspace from scratch, once there has been sufficient time for all mirrors
to receive the new deb.

# To build all from scratch:

1. Install [Docker Toolbox](https://www.docker.com/products/docker-toolbox).
1. Launch **Docker QuickStart Terminal**.
1. Execute `cd /path/to/ide50-docker`.
1. Execute `make build` and wait. This builds all images sequentially.
1. Start the built offline container with `make run`.
1. (Mac OS X only) Execute `make open` to automatically open a tab in your favorite
   browser that loads the offline IDE.

# Rebuild after making changes

1. Stop the running offline container with `make stop`
1. Delete offline image with `make clean`
1. Re-build offline (only) with `make offline`

Rebuilding from an earlier version (say, if you need to build a new
<tt>ide50</tt> container with a new version of the ide50 deb) will require
rebuilding from that container. It's probably easiest to delete all images
and then run `make build`.

## Command list

There are a variety of commands in `make` to help re-build an image.
* `make build` Builds the `wkspc` image, then the `ide` image, then
  the `offline` image.
* Build individual images with `make wkspc`, `make ide`, and
  `make offline`, respectively.
* `make run` runs an already-built offline container
* `make stop` then stops that running container
* `make open` (Mac OS X only, probably) opens the offline IDE in your browser.
* `make shell` to open a shell in the running container
* `make clean` removes the offline image and container *only*

# To install for cloud9:
1. Change line 1 of ide50/Dockerfile to <tt>FROM cloud9/workspace</tt>
2. Zip ide50 (<tt>zip -r ide50 ide50</tt>).
3. Email to Nikolai Onken, nikolai@c9.io
