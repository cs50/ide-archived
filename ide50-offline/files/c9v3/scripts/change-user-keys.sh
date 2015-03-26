#!/bin/bash

set -e

UNAME=$1

if [ -z "$UNAME" ]; then
    echo Regenerate the SSH key pair of a user
    echo Usage: $0 UNAME
    exit 1
fi

cd $(dirname $0)

REDIS=$(./cli.js --print -s deploy)
USER_ID=$($REDIS hget u/unames $UNAME)
EMAIL=$($REDIS hget u/$USER_ID email)

DIR=$(mktemp -d)

ssh-keygen -N "" -C "$EMAIL" -f $DIR/ssh

$REDIS hset u/$USER_ID pubkey "$(cat $DIR/ssh.pub)"
$REDIS hset u/$USER_ID prvkey "$(cat $DIR/ssh)"

rm -rf $DIR

echo "Regerneated SSH keys for user '$UNAME' <$EMAIL> ($USER_ID)"
