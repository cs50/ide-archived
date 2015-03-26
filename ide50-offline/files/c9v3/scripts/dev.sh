#!/bin/bash

echo "Running dev environment"
node server.js dev | grep -v _ping
until $(curl --output /dev/null --silent --head --fail http://localhost:8092/_ping); do
    printf '.'
    sleep 1
done
echo "Dev server online"