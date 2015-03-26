#!/bin/bash -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

if ! type nw-gyp > /dev/null; then
    npm install nw-gyp -g
fi

rm -Rf ../node_modules/pty.nw.js
mkdir ../node_modules/pty.nw.js
cd ../node_modules/pty.nw.js
curl -L -o v0.2.3.tar.gz https://github.com/chjj/pty.js/archive/v0.2.3.tar.gz
tar -zxvf v0.2.3.tar.gz
mv pty.js-0.2.3/* .
rm -rf pty.js-0.2.3
rm v0.2.3.tar.gz
make clean
nw-gyp configure --target=0.8.3
nw-gyp build
