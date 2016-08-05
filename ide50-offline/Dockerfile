FROM ide50
MAINTAINER Dan Armendariz <danallan@cs.harvard.edu>

RUN curl -sL https://deb.nodesource.com/setup | bash - && \ 
    apt-get install nodejs -y

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
ADD ./files/harvard.cs50.audioplayer plugins/c9.ide.cs50.audioplayer
ADD ./files/harvard.cs50.cat plugins/c9.ide.cs50.cat
ADD ./files/harvard.cs50.droplet plugins/c9.ide.cs50.droplet
ADD ./files/harvard.cs50.gist plugins/c9.ide.cs50.gist
ADD ./files/harvard.cs50.info plugins/c9.ide.cs50.info
ADD ./files/harvard.cs50.presentation plugins/c9.ide.cs50.presentation
ADD ./files/harvard.cs50.previewer plugins/c9.ide.cs50.previewer
ADD ./files/harvard.cs50.simple plugins/c9.ide.cs50.simple
ADD ./files/harvard.cs50.theme plugins/c9.ide.cs50.theme
RUN sudo chown -R ubuntu:ubuntu plugins

# install CS50's configuration
ADD ./files/client-workspace-cs50.js configs/

# install C9
RUN scripts/install-sdk.sh

# set defaults
RUN sudo chown -R ubuntu:ubuntu /home/ubuntu/workspace/ && \
    sudo chown -R ubuntu:ubuntu /home/ubuntu/.c9/

EXPOSE 5050 8080
ENTRYPOINT ["node", "server.js", \
            "-w", "/home/ubuntu/workspace", \
            "--workspacetype=cs50", \
            "--auth", ":", \
            "--listen", "0.0.0.0", \
            "--port", "5050"]
