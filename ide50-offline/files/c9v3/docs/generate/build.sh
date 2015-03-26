#!/bin/bash -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PANINO="lib/node_modules/panino/bin/panino"

cd $DIR

if [ "$1" == "all" ]; then
    ./build.sh clean
    ./build.sh autocomplete
    ./build.sh refguide

elif [ "$1" == "clean" ]; then

	rm -Rf output/*

elif [ "$1" == "autocomplete" ]; then
    
	type $PANINO >/dev/null 2>&1 || { echo >&2 "panino is not installed. Please run build.sh install-deps."; exit 1; }
	
	mkdir -p output/{symbols,parsed}
	$PANINO \
	    --disableTests \
	    --additionalObjs lib/node_modules/panino/additionalObjs.json \
	    --output output/symbols \
	    --custom-tags fires,preventable \
	    --skin lib/node_modules/panino/skins/goose/templates/layout.jade \
	    -y jsd output/parsed

elif [ "$1" == "refguide" ]; then

    type jsduck >/dev/null 2>&1 || { echo >&2 "jsduck is not installed. Please run build.sh install-deps."; exit 1; }

    mkdir -p output/parsed
    for F in template{,_minimal}.js \
             c9.ide.language/{base_handler,complete_util,worker_util,MarkerResolution}.js \
             c9.ide.language.jsonalyzer/jsonalyzer.js \
             c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler.js
    do
        cp ../../plugins/$F output/parsed
    done
    cat docs.list | grep -v "#" | lib/scan.js
    jsduck --config=cloud9-jsduck.json

elif [ "$1" == "install-deps" ]; then
    if ! node --version >&/dev/null || node --version | grep -q v0.6; then
        echo Please install node 0.10 or newer
        exit
    fi
    cd lib
    npm install
    
    rm -Rf node_modules/treehugger
    ln -s ../../../../node_modules/treehugger node_modules/treehugger
    
    if ! type jsduck >/dev/null 2>&1; then
        gem install jsduck
    fi
else
    echo "Usage build.sh [all|clean|autocomplete|refguide|install-deps]"
    echo
fi
