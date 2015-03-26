#!/bin/bash

echo "Error: this script should be updated for the new multi-vfs setup"
exit 1

readonly SCRIPTS=`dirname $BASH_SOURCE`

if ! which parallel &>/dev/null || [ `$SCRIPTS/gssh 2>&1 | wc -l` -lt 50 ]; then
    echo Error: gssh is misconfigured >&2
    $SCRIPTS/gssh prod pwd
    exit 1
fi

while true; do
    $SCRIPTS/gssh -f -q -P vfs-prod '
        if ! curl --max-time 5 http://localhost:8083/_ping &>/dev/null; then
        if ! curl --max-time 10 http://localhost:8083/_ping &>/dev/null &&
           ! curl --max-time 10 http://localhost:8083/_ping &>/dev/null &&
           ! curl --max-time 10 http://localhost:8083/_ping &>/dev/null &&
           ! curl --max-time 10 http://localhost:8083/_ping &>/dev/null &&
           ! curl --max-time 10 http://localhost:8083/_ping &>/dev/null &&
           ! curl --max-time 10 http://localhost:8083/_ping &>/dev/null
        then
            echo Restarting `hostname`
            super9 stop vfs: || :
            echo "forever-supervisor.sh: killed process. server was not responding to /_ping" >> ~/.runjs/vfs-program.log
            ~/supervisord_start_script.sh
        fi
    '
    echo -n '.'
    sleep 60
done
