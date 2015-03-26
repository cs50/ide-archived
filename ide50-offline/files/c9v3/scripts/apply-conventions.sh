#!/bin/bash
cd `dirname $0`/..

if which gsed &>/dev/null; then
    SED=gsed
else
    SED=sed
fi

if [ -h plugins/c9.ide.collab/server/collab-server.js ]; then
    COLLAB_LINK=1
fi

for D in scripts bin build plugins settings configs; do
    # 'function(x) {', not 'function(x){'
    find $D -name '*.js' | xargs $SED -Ei 's/(\w)\)\{(\s*$|\}(\)|;|\s*$))/\1) {\2/' 
    # 'property: value' not 'property    :    value'
    find $D -name '*.js' | xargs $SED -Ei 's/^(^[ \t]*[A-Za-z$_]+)[ \t]*:[ \t]*([^\n \t])/\1: \2/'
    # 'if (x)' not 'if(x)' (but allow else if(x) in packed code)
    find $D -name '*.js' | xargs $SED -Ei 's/([^e]) (if|while|for|do|catch)\(/\1 \2 \(/'
    # 'else if (x)' not 'else if(x)'
    find $D -name '*.js' | xargs $SED -Ei 's/ else if\(/ else if \(/'
    # 'foo = bar' not 'foo    =    bar'
    find $D -name '*.js' | while read F; do
    	cp "$F" tmpfile
    	cat "$F" | perl -pe 's/([^\n \t])[ \t]{2,}=(?!=)[ \t]*/$1 = /g'> tmpfile
    	mv tmpfile "$F"
    done
    find $D -name '*.js' | xargs dos2unix
done

git checkout plugins/c9.vfs.standalone/www/html2canvas.js
git checkout plugins/c9.dashboard.new/html2canvas.js
git checkout plugins/c9.homepage/public/javascripts/jquery-1.11.0.min.js
git checkout plugins/c9.homepage/public/javascripts/jquery.validate.min.js
git checkout 'plugins/c9.fs/mock/test blah$.js'
git checkout plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags.js
git checkout plugins/c9.ide.ui/lib_firmin.js

if [ "$COLLAB_LINK" ]; then
    git checkout plugins/c9.ide.collab/server/collab-server.js
fi

echo Conventions applied:
git status