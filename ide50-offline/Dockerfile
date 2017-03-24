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
