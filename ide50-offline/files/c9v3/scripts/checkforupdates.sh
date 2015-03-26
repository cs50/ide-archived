verifyUpdate() {
    local UPDATEFILE="$1"
    
    echo "Verifying update in $UPDATEFILE"

    if [ ! "$NODE" ]; then
        NODE=node
    fi

    "$NODE" -e '
        var fs = require("fs");
        var cr = require("crypto");
        var publicKey = "-----BEGIN PUBLIC KEY-----\n"
            + "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCT9JG3+heFQBqKlfByIrb57tws\n"
            + "JnPpZEjZC5DMYs1HmPK9/EuRrB2IYbB0gIY4F0Di8PEPqB3W3nPtN8pCB5ac4ZlT\n"
            + "Y65mp6jtlUjwahIrQkkEbmvASfmeARdb4gA8U149LwarUYctALv1+HvViomGoKvL\n"
            + "UJgFIvZdMHMaMCPZ0wIDAQAB\n"
            + "-----END PUBLIC KEY-----";
        console.log("reading '"$UPDATEFILE"'")
        var package = fs.readFileSync("'"$UPDATEFILE"'");
        var sig = fs.readFileSync("'"$UPDATEFILE"'.sig", "utf-8");
        
        var verify = cr.createVerify("sha1");
        verify.update(package);
        if (!verify.verify(publicKey, sig, "base64")){
            console.error("Code signature invalid!");
            process.exit(1);
        }
    ' || exit 1
    echo "Successfully verified update signature"
}

has() {
  type "$1" > /dev/null 2>&1
  return $?
}

# When executing from the command-line, we take one argument
if [ $# == 1 ]; then
    verifyUpdate "$1"
    exit
fi

# When executing from the update plugin, we take many arguments
# They are replaced by values from the calling script
APPROOT="$R1"
APPPATH="$R2"
INSTALLPATH="$R3"
DATE="$R4"
NODE="$R5"
URL="$R6"

UPDATEDIR="$INSTALLPATH/updates/app.nw"
VERSIONFILE="$APPPATH/version"

if has "curl"; then
  DOWNLOAD="curl -sSOL"
elif has "wget"; then
  DOWNLOAD="wget -nc"
else
  echo "Error: you need curl or wget to proceed" >&2;
  exit 1
fi

# Get platform
PLATFORM=`uname`

# Get the current version
# VERSION=`cat "$VERSIONFILE"`

set -e

cleanup() {
    if [ -e "$INSTALLPATH/updates/" ]; then
        rm -Rf "$INSTALLPATH/updates/"
    fi
}

# Check if update exists
if [ -e "$UPDATEDIR" ]; then

    echo "UPDATEDIR found, attempt to update Cloud9."

    echo "APPROOT: ${APPROOT}"
    echo "APPPATH: ${APPPATH}"
    echo "INSTALLPATH: ${INSTALLPATH}"
    echo "DATE: ${DATE}"
    echo "NODE: ${NODE}"
    echo "UPDATEDIR: ${UPDATEDIR}"
    echo "VERSIONFILE: ${VERSIONFILE}"

    verifyUpdate "$UPDATEDIR/../$DATE"
    
    echo "Updating Cloud9..."
    
    # Define the location of the backup dir
    BACKUPDIR="$APPROOT/app.nw.backup"
    
    # fetch node-webkit version from package
    # if none defined, skip
    if [ -e "$UPDATEDIR/nwversion" ]; then
    
        NWVERSION=`cat "$UPDATEDIR/nwversion"`
        
        # if defined compare to installed
        # if different download new node-webkit package
        if [ $NWVERSION != `cat "$APPPATH/nwversion"` ]; then
            
            cd "$INSTALLPATH/updates"

            # Update node webkit only supported for mac now
            if [[ "$PLATFORM" == 'Darwin' ]]; then 
                # fetch tar.gz
                $DOWNLOAD $URL/nw.$NWVERSION.tar.gz
        
                # replace Contents folder with that of the downloaded tar.gz
                tar zxvf nw.$NWVERSION.tar.gz
                rm nw.$NWVERSION.tar.gz
            
                # create a backup of the current contents
                rm -Rf "$APPROOT/../../Contents.backup" 2&> /dev/null
                mv "$APPROOT/../../Contents" "$APPROOT/../../Contents.backup"
            
                # move to the right place
                mv "$INSTALLPATH/updates/Contents" "$APPROOT/../../Contents"
            fi
            
            echo $NWVERSION > "$APPPATH/nwversion"
        fi
    fi

    # Remove backup dir if it exists
    rm -Rf "$BACKUPDIR" 2&> /dev/null
    
    # Move all files to the backup dir
    mv "$APPPATH" "$BACKUPDIR"
    
    # Move the updated files to app.nw
    mv "$UPDATEDIR" "$APPPATH"
    
    # Write the version file
    echo "$DATE" > "$VERSIONFILE"
    
    echo "Verifying permissions"
    chmod -R 775 "$APPROOT/app.nw"
    
    echo "Updating Done."
    
    # Cleanup 
    cleanup
    exit 0
else
    echo "UPDATEDIR does not exist."
    exit 0
fi
