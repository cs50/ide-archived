#!/bin/bash

while [ TRUE ]
do
node server.js -p 8282 $1 $2
done
