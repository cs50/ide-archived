#!/bin/bash

set -e

UNAME=$1
EMAIL=${2,,}

if [ -z "$UNAME" ] || [ -z "$EMAIL" ]; then
    echo Usage: $0 UNAME EMAIL
    exit 1
fi

cd $(dirname $0)

REDIS=$(./cli.js --print -s deploy)
USER_ID=$($REDIS hget u/unames $UNAME)
OLD_EMAIL=$($REDIS hget u/$USER_ID email)

$REDIS hset u/$USER_ID email $EMAIL
$REDIS ZREM u/emails $OLD_EMAIL
$REDIS zadd u/emails $USER_ID $EMAIL

echo "Changed email for user '$UNAME' ($USER_ID):"
echo "$OLD_EMAIL -> $EMAIL"