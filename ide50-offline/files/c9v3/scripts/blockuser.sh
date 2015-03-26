#!/bin/bash
FILETMP=/tmp/rd_blockuser

HOSTREAD=redis-slave.c9.io
HOSTWRITE=redis.c9.io
PORT=9001
PW=bfH7gWIsYh5RdBVdFzijnbwO
MODE=--raw

# redis cmds
CMDREAD="redis-cli -h ${HOSTREAD}  -d ';' -p 9001 -a $PW "
CMDWRITE="redis-cli $MODE -h $HOSTWRITE -d ';' -p 9001 -a $PW "

# initialize
rm -f $FILETMP

# check argument
if [ $# -ne 1 ]; then echo "please provide UID"; exit 1; fi
USERID=$1
if [ ! $USERID -ge 1 ]; then echo "please provide a *valid* UID"; exit 2; fi

# get required user info
USERNAME=`${CMDREAD} hget u/${USERID} name`
EMAIL=`${CMDREAD} hget u/${USERID} email`
echo USERID: $USERID
echo USERNAME: $USERNAME
echo EMAIL: $EMAIL
if [ -z "$USERID" ] || [ -z "$USERNAME" ] || [ -z $EMAIL ]; then echo "cannot continue, values not retrieved"; exit 3; fi

# build tmpfile containing redis commands
echo ----blockuser-------------------
echo "hgetall u/${USERID}" > $FILETMP
echo "hget u/${USERID} password" >> $FILETMP
echo "hset u/${USERID} password blocked" >> $FILETMP
echo "hset u/${USERID} email ${EMAIL}-blocked"  >> $FILETMP
echo "hset u/${USERID} name ${USERNAME}-blocked" >> $FILETMP
echo "zscore u/emails ${EMAIL}" >> $FILETMP
echo "zrem u/emails ${EMAIL}" >> $FILETMP
echo "zadd u/emails -${USERID} ${EMAIL}" >> $FILETMP

# execute all
cat $FILETMP
chmod 755 $FILETMP
$CMDWRITE < $FILETMP

echo
echo ----REMINDER-------------------
echo Please do not forget to add the blocked user information to
echo intranet: https://sites.google.com/a/c9.io/intranet/howto/support/blocked-users

