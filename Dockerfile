FROM cloud9/ws-php
MAINTAINER Dan Armendariz <danallan@cs.harvard.edu>

# increment version to force flushing the cache
RUN echo "Version 2.0"

ENV DEBIAN_FRONTEND noninteractive

RUN wget -O - http://mirror.cs50.net/ide50/2015/keyFile | sudo apt-key add -
RUN add-apt-repository "deb http://mirror.cs50.net/ide50/2015/dists/trusty/main/binary-amd64/ /"
RUN rm -rf /etc/php5/mods-available/xdebug.ini /home/ubuntu/workspace/*
RUN curl -H 'Cache-Control: no-cache' -sL https://cs50.ly/update50 | bash

RUN echo "Success" > /var/www/html/file

RUN chown -R ubuntu:ubuntu /home/ubuntu && \
    chown -R ubuntu:ubuntu /home/ubuntu
RUN curl -sL https://deb.nodesource.com/setup | bash - && \
    apt-get install nodejs -y

# install and select node v7.6.0
RUN export NVM_DIR=/home/ubuntu/.nvm && \
    . $NVM_DIR/nvm.sh && \
    nvm install 7.6.0 && \
    nvm alias default 7.6.0

# install Composer
# https://www.digitalocean.com/community/tutorials/how-to-install-and-use-composer-on-ubuntu-14-04
RUN curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer

# install hub
# https://hub.github.com/
# http://stackoverflow.com/a/27869453
RUN mkdir /tmp/hub-linux-amd64 && \
    curl -s -L https://github.com/github/hub/releases/latest | \
        egrep -o '/github/hub/releases/download/.*/hub-linux-amd64-.*.tgz' | \
        wget --base=http://github.com/ -i - -O - | \
        tar xvz -C /tmp/hub-linux-amd64 --strip-components 1 && \
    /tmp/hub-linux-amd64/install && \
    rm -rf /tmp/hub-linux-amd64

# populate some env variables
RUN echo "export USER=ubuntu\n\
export C9_PROJECT=ide50-offline\n\
export C9_USER=jharvard\n\
export C9_HOSTNAME=\$OFFLINE_IP\n\
export C9_PORT=\$OFFLINE_PORT\n\
export IDE_OFFLINE=1\n\
alias c9=/var/c9sdk/bin/c9" >/etc/profile.d/offline.sh

# since C9_USER didn't exist until now, mysql.sh doesn't have username
RUN sed -i 's/MYSQL_USERNAME.*/MYSQL_USERNAME="jharvard"/' \
    /etc/profile.d/mysql.sh

USER ubuntu

# download C9 core
WORKDIR /var
RUN sudo rm -rf c9sdk && \
    sudo mkdir c9sdk && \
    sudo chown ubuntu:ubuntu c9sdk && \
    git clone https://github.com/c9/core.git c9sdk

# install CS50's plugins
WORKDIR c9sdk
COPY ./files/plugins plugins/
RUN sudo chown -R ubuntu:ubuntu plugins

# install CS50's configuration
ADD ./files/workspace-cs50.js configs/ide/

# install C9
RUN scripts/install-sdk.sh

# set defaults
RUN sudo chown -R ubuntu:ubuntu /home/ubuntu/workspace/ && \
    sudo chown -R ubuntu:ubuntu /home/ubuntu/.c9/

EXPOSE 5050 8080 8081 8082
ENTRYPOINT ["node", "server.js", \
            "-w", "/home/ubuntu/workspace", \
            "--workspacetype=cs50", \
            "--auth", ":", \
            "--collab", \
            "--listen", "0.0.0.0", \
            "--port", "5050"]
