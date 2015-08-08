FROM ide50
MAINTAINER Dan Armendariz <danallan@cs.harvard.edu>

RUN curl -sL https://deb.nodesource.com/setup | bash - && \ 
    apt-get install nodejs -y

# populate some env variables
RUN echo "\n\
export USER=ubuntu\n\
export C9_PROJECT=ide50-offline\n\
export C9_USER=jharvard\n\
export C9_HOSTNAME=\$OFFLINE_IP\n\
export C9_PORT=\$OFFLINE_PORT\n\
export IDE_OFFLINE=1" >>/etc/profile.d/ide50.sh

USER ubuntu

# download C9 core
WORKDIR /var
RUN sudo rm -rf c9sdk && \
    sudo mkdir c9sdk && \
    sudo chown ubuntu:ubuntu c9sdk && \
    git clone https://github.com/c9/core.git c9sdk

# install cs50 plugins
WORKDIR c9sdk
ADD ./files/ide50-plugin/ plugins/c9.ide.plugins/
RUN sudo chown -R ubuntu:ubuntu plugins/c9.ide.plugins/cs50*

# notify c9sdk to run CS50 plugins (inject each plugin in "Other" category)
RUN sed -i 's-.*// Other.*-&\n\
        "plugins/c9.ide.plugins/cs50stats/stats50",\n\
        "plugins/c9.ide.plugins/cs50simple/simple50",\n-' \
    configs/client-default.js


# install C9
RUN scripts/install-sdk.sh

# force terminal tabs to say "Terminal"
RUN sed -i 's/";", "set-option", "set-titles", "on",/";", "set-option", "set-titles", "off",/' \
    /var/c9sdk/node_modules/vfs-local/localfs.js

# set defaults
ADD ./files/state.settings /home/ubuntu/workspace/.c9/
ADD ./files/user.settings /home/ubuntu/.c9/
RUN sudo chown -R ubuntu:ubuntu /home/ubuntu/workspace/ && \
    sudo chown -R ubuntu:ubuntu /home/ubuntu/.c9/

EXPOSE 5050 8080
ENTRYPOINT ["node", "server.js", \
            "-w", "/home/ubuntu/workspace", \
            "--auth", ":", \
            "--listen", "0.0.0.0", \
            "--port", "5050"]
