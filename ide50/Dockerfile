FROM workspace
MAINTAINER Dan Armendariz <danallan@cs.harvard.edu>

RUN wget -O - http://mirror.cs50.net/ide50/2015/keyFile | sudo apt-key add -
RUN add-apt-repository "deb http://mirror.cs50.net/ide50/2015/dists/trusty/main/binary-amd64/ /"

RUN apt-get update && apt-get install ide50 -y

RUN echo "Success" >/var/www/html/file
