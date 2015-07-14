# ide50-docker
IDE50's Docker configuration for Cloud9

Since Docker containers are built incrementally, building an offline container
requires first creating an underlying <tt>workspace</tt> image, then building
an <tt>ide50</tt> image on top of that, and then finally creating the
<tt>ide50-offline</tt> image on top. There are some `make` commands to
simplify this process.

# To build all from scratch:

1. Install [boot2docker](http://boot2docker.io).
1. Run boot2docker (or in a Terminal, type <tt>boot2docker start</tt>)
1. Once it's loaded, cd to the root of this repo
1. Run `make build` and wait. This builds all images sequentially.
1. Run the built offline container with `make run`.
1. (Mac OS X only) run `make open` to automatically open a tab in your favorite
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
1. Change line 1 of ide50/Dockerfile to 'FROM cloud9/workspace'
2. Zip ide50 (<tt>zip -r ide50 ide50</tt>).
3. Email to Nikolai Onken, nikolai@c9.io
