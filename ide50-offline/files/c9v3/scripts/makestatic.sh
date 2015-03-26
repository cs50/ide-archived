#!/bin/bash 

set -e
set -x

while [ "$1" ]; do
  case "$1" in
    --dry-run)
      DRYRUN=1
      ;;
    --help)
      echo "makestatic.sh"
      echo "--dry-run             Don't upload to CDN"
      echo "--disable-compress    Don't compress. As an environment variable: STATIC_DISABLE_COMPRESS=1"
      echo "--devel               Create both compressed and uncompressed versions"
      echo "--test                Quick version for testing"
      exit 0
      ;;
    --disable-compress)
      STATIC_DISABLE_COMPRESS=1
      ;;
    --devel)
      DEVEL=1
      ;;
    --test)
      STATIC_DISABLE_COMPRESS=1
      DRYRUN=1
      TEST_BUILD=1
      ;;
    --tmpdir)
      TMPDIR=./tmp
      ;;
    *)
      echo "Illegal option: $1"
      exit 1
      ;;
  esac
  shift
done

COMPRESS_OPTION=
COMPRESS_SUFFIX="-uc"
if ! [ "$STATIC_DISABLE_COMPRESS" == "1" ]; then
  COMPRESS_OPTION="--compress"
  COMPRESS_SUFFIX=""
fi

if [ "$DEVEL" == "1" ]; then
    COMPRESS_OPTION="--compress-output-dir-prefix=/../min"
    COMPRESS_SUFFIX="-uc"
fi

# Primitive check for #3653 for now
if cat package.json | grep engine.io | grep -q 1.3.1 \
   && ! cat node_modules/engine.io/package.json | grep -q 1.3.1; then
   echo "Error: bad node_modules version detected; please run make node_modules">&2
   exit 1
fi

cd `dirname $0`
CURDIR=`pwd`

if [ ! "$TMPDIR" ]; then
  TMPDIR=/tmp
fi

REVISION=`git rev-parse HEAD`
REV=${REVISION:0:8}
VERSION=nc-`node -e 'console.log(require("../package.json").version)'`-$REV$COMPRESS_SUFFIX
CACHE="$TMPDIR/cdn/nc-$REV-`date +%s`"
DEST=$CACHE/$VERSION


#CDN="echo server.js cdn-cli"
CDN="../server.js cdn-cli --settings deploy $COMPRESS_OPTION --version=$VERSION --skip-duplicates --cache=$CACHE"
if ! [ "TEST_BUILD" == "1" ]; then
  CDN="$CDN --copy-static-resources"
fi


# todo add submodule support to architect build
buildSubModules() {
  mkdir -p "$DEST/modules/plugins/c9.ide.collab/server/"
  cp "$CURDIR/../plugins/c9.vfs.extend/collab-server.js" "$DEST/modules/plugins/c9.ide.collab/server/"
  mkdir -p "$DEST/modules/lib/emmet"
  cp "$CURDIR/../node_modules/emmet/emmet.js" "$DEST/modules/lib/emmet/"
}

buildMain() {
  WORKER=plugins/c9.ide.language/worker
  echo building worker $WORKER
  $CDN --worker $WORKER
  
  mainConfigs="default,ssh,default-ro,openshift"
  for ws in $(cd $CURDIR/../configs; ls client-workspace* | grep -o 'workspace-.*' | sed s/\\.js//); do
    mainConfigs="$mainConfigs,$ws"
  done
  
  if [ "TEST_BUILD" == "1" ]; then
    $CDN --config "$mainConfigs" --with-skins dark
  else
    # build async loaded ace modules
    $CDN --module ace
    # build configs and skins
    $CDN --config "$mainConfigs" --with-skins
  fi
}


# copy static files from the homepage
buildHomepage() {
  mkdir -p $DEST/static
  node ./makestatic.js homepage --settings=deploy --dest=$DEST/_homepage
  mv $DEST/_homepage/homepage $DEST/static
}

buildOldClient() {
  mkdir -p $DEST/static
  node ./makestatic.js oldclient --settings=deploy --dest=$DEST/_oldclient
  mv $DEST/_oldclient/oldclient $DEST/static
}

buildAccount() {
    node "../plugins/c9.react/style-server.cli.js"
    $CDN --server-config account --config "account,profile"
}

# handle configs that are identical to the default config
otherConfigs() {
  for CONFIG in $(cat $DEST/config/duplicates); do
    if [ "$1" == "cp" ]; then
      cp $DEST/config/default.js $DEST/config/$CONFIG.js
      cp $DEST/config/default.js.gz $DEST/config/$CONFIG.js.gz
      cp -R $DEST/skin/default $DEST/skin/$CONFIG
    else
      rm $DEST/config/$CONFIG.js
      rm $DEST/config/$CONFIG.js.gz
      rm -Rf $DEST/skin/$CONFIG
    fi
  done
}

clean_up() {
  rm -rf "$DEST"
  rm -rf "$DEST"/../min
}

rmMinifiedFiles() {
  local target=$DEST/../min/
  if [ "$DEVEL" == "1" ]; then
    while IFS= read -d $'\0' -r file ; do
      file=${file:${#target}}
      rm "$DEST/$file";
    done < <(find "$target" -type f  -print0);
  fi
}


restoreMinifiedFiles() {
  local target=$DEST/../min/
  if [ "$DEVEL" == "1" ]; then
    while IFS= read -d $'\0' -r file ; do
      file=${file:${#target}}
      cp "$target/$file" "$DEST/$file";
    done < <(find "$target" -type f  -print0);
  fi
}

gzipAll() {
  echo Compressing files
  local gzip=gzip
  if [ "$DRYRUN" == "1" ]; then
    gzip=echo
  fi
  
  for i in `find $DEST -type f -name "*.css" -o -name "*.js" -o -name "*.json" -o -name "*.html" -o -name "*.svg" -o -name "*.xml"`; do \
    $gzip -9 -v -c -q -f $i > $i.gz || true
  done
}

upload() {
  gzipAll
  
  otherConfigs cp
  
  cd $CACHE
  tar --exclude-from=$CURDIR/s3exclude -czf $VERSION.tgz $VERSION

  echo Uploading to the static server
  if ! [ "$DRYRUN" ]; then
    ssh ubuntu@static.c9.io "cd static && rm -rf $VERSION $VERSION.tgz"
    scp $VERSION.tgz ubuntu@static.c9.io:static
    ssh ubuntu@static.c9.io "cd static && tar xfz $VERSION.tgz && rm -rf $VERSION.tgz"
  else
    rm -rf remote-$VERSION
    cp -R $VERSION remote-$VERSION
    cp $VERSION.tgz remote-$VERSION.tgz
  fi
}

# main
clean_up

buildAccount

buildSubModules
buildMain
buildHomepage
buildOldClient


if ! [ "$TEST_BUILD" == "1" ]; then
  upload
fi


if [ "$DEVEL" == "1" ]; then
  otherConfigs rm
  VERSION=${VERSION:0:${#VERSION}-${#COMPRESS_SUFFIX}}
  DEST=${DEST:0:${#DEST}-${#COMPRESS_SUFFIX}}
  
  rm -rf $DEST
  mv "$DEST$COMPRESS_SUFFIX" "$DEST"
  
  cd $CURDIR/..
  
  rmMinifiedFiles
  node -e "require('architect-build/compress_folder')('$DEST', {exclude: /\bmin\b|ace/})"
  restoreMinifiedFiles
  upload
fi

if ! [ "$DRYRUN" ]; then
  clean_up
  rm -rf $CACHE
fi
