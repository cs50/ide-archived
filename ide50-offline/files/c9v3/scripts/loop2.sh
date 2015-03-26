#!/bin/bash

while [ TRUE ]
do
node server.js -p 8383 -dt $1 $2
done
