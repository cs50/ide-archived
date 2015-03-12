# configure prompt
if [ "$PS1" ]; then
  export PS1="\u@\h (\w): "
fi
# disable auto-logout
export TMOUT=0
# enable accessibility
export GTK_MODULES=gail:atk-bridge
# suppress this error for now: /home/jharvard/.dropbox-dist/libz.so.1: version `ZLIB_1.2.3.3' not found (required by /usr/lib/libxml2.so.2) F$
# http://forums.dropbox.com/topic.php?id=48321 http://forums.dropbox.com/topic.php?id=19439
alias dropbox="dropbox 2> /dev/null"
# if not root
if [[ $UID -ne 0 ]]; then
  # set umask
  umask 0077
  # configure clang
  export CC=clang
  export CFLAGS="-ggdb3 -O0 -std=c99 -Wall -Werror"
  export LDLIBS="-lcs50 -lm"
  # protect user
  alias cp="cp -i"
  alias mv="mv -i"
  alias rm="rm -i"
fi
# set editor
export EDITOR=nano
# set locale
export LANG=C
# Node.js
export NODE_ENV=dev