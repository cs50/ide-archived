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

1. Install [Docker Engine](https://docs.docker.com/engine/installation/).
1. Open a terminal window.
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

# Deploying a new offline image

We generally deploy a new offline version when a new version of the
[ide50 deb](https://github.com/cs50/ide50) is released.
This way, people that download the offline version are sure to have the
very latest.

## Preparation

1. Clean all existing images and containers. Building from scratch is
   generally preferred since it ensures the latest version of Ubuntu
   and other packages. Use `docker ps -a` to see a full list of docker
   containers, stopping any relevant ones if necessary, and remove them
   with `docker rm`. Use `docker images` to see a list of images,
   and use `docker rmi` to delete those images. I usually delete all images
   that are associated with the offline IDE to be sure to build from scratch.
2. Run `make build` to build from scratch.
3. Run the offline with `make run` to ensure the latest deb was installed
   and all changes are as they appear.

## Deployment

If all looks good after a successful complete build, begin the actual
deployment steps:

1. Run `make squash` to [squash](https://github.com/jwilder/docker-squash) the
   docker image into as small of a size as possible. Note: docker squash
   tools tend to change rapidly, so you may need to update the `squash` rule
   in the Makefile periodically, or update the copy of the docker-squash.
2. Once that's done, apply both "beta" and "latest" tags to the build
   version. "Beta" builds are at least as new as the "latest", but sometimes
   its useful to release just a "beta" build with features that others test:
```shell
docker tag ide50-offline cs50/ide50-offline:beta
docker tag ide50-offline cs50/ide50-offline:latest
```
3. Push the tags to Docker hub:
```shell
docker push cs50/ide50-offline:beta
docker push cs50/ide50-offline:latest
```

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

# HOWTOs

## Re-build SDK

After making changes to CSS (e.g., in `/var/c9sdk/plugins/*`) or config files (e.g., `/var/c9sdk/configs/ide/workspace-cs50.js`):

    cd /path/to/ide50-docker
    make shell
    /var/c9sdk/scripts/install-sdk.sh
    exit
    make restart

# Troubleshooting

## Error checking TLS connection: Error checking and/or regenerating the certs

    docker-machine regenerate-certs default

If something still seems awry with Docker, odds are the below will help. **The below will delete and recreate the virtual machine used by Docker.**

    docker-machine stop default
    docker-machine rm default
    docker-machine create --driver virtualbox default
    eval $(docker-machine env default)
