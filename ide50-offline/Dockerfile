FROM ide50
MAINTAINER Dan Armendariz <danallan@cs.harvard.edu>

RUN rm /home/ubuntu/.dropbox50

RUN curl -sL https://deb.nodesource.com/setup | bash - && \ 
    apt-get install nodejs -y

USER ubuntu

# download C9 core
WORKDIR /var
RUN sudo mkdir c9sdk && \
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

EXPOSE 5050 8080
ENTRYPOINT ["node", "server.js", \
            "-w", "/home/ubuntu/workspace", \
            "--auth", ":", \
            "--listen", "0.0.0.0", \
            "--port", "5050"]
