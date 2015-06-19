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

# install C9
WORKDIR c9sdk
RUN scripts/install-sdk.sh

EXPOSE 5050 8080
ENTRYPOINT ["node", "server.js", \
            "-w", "/home/ubuntu/workspace", \
            "--auth", ":", \
            "--listen", "0.0.0.0", \
            "--port", "5050"]
