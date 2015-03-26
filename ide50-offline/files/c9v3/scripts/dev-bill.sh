#!/bin/bash

echo "Running billing / accounts environment"
node server.js ide preview vfs api sapi proxy redis oldclient homepage apps-proxy account -s devel | grep -v _ping
until $(curl --output /dev/null --silent --head --fail http://localhost:8092/_ping); do
    printf '.'
    sleep 1
done
echo "Bill server online"