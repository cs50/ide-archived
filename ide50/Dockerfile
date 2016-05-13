#FROM cloud9/ws-php
FROM workspace
MAINTAINER Dan Armendariz <danallan@cs.harvard.edu>

# increment version to force flushing the cache
RUN echo "Version 1.28"

ENV DEBIAN_FRONTEND noninteractive

RUN wget -O - http://mirror.cs50.net/ide50/2015/keyFile | sudo apt-key add -
RUN add-apt-repository "deb http://mirror.cs50.net/ide50/2015/dists/trusty/main/binary-amd64/ /"

RUN rm -f /etc/php5/mods-available/xdebug.ini
RUN apt-get update && apt-get install -y ide50

RUN echo "Success" > /var/www/html/file

RUN chown -R ubuntu:ubuntu /home/ubuntu && \
    chown -R ubuntu:ubuntu /home/ubuntu
