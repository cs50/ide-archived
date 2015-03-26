DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# copy tar.gz
cp $DIR/../build/output/latest.tar.gz ~/.c9/updates;

# unpack it
cd ~/.c9/updates
tar -zxvf ~/.c9/updates/latest.tar.gz 2> /dev/null

# set the version
cd updatepackage
echo -n 10000000 > version

echo Fake update is ready.