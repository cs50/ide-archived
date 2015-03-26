#!/bin/sh -e

if grep -Ei 'hostname[ \t]*github.com' ~/.ssh/config >/dev/null; then
  echo "check-ssh-config.sh: git ssh access seems to be correctly configured"
else
  echo "Please add your github ssh key to your ~/.ssh/config, like so:

    Host github.com
      User git
      Port 22
      Hostname github.com
      IdentityFile ~/.ssh/id_rsa
      TCPKeepAlive yes
      IdentitiesOnly yes"
  echo
  echo "(Instead of ~/.ssh/id_rsa you may want to add the path to your personal GitHub SSH key.)"
  echo "(User git is fine, though.)"
  exit 1
fi
