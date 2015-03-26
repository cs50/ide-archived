FROM 3f59684c208c
MAINTAINER Dan Bradley <dan.b.bradley@gmail.com> 

ADD ./files/c9v3 /home/ubuntu/c9v3
ADD ./files/bin /usr/bin

RUN chmod -R g+w /home/ubuntu/c9v3 && \
    chown -R ubuntu:ubuntu /home/ubuntu/c9v3

RUN chmod 755 /usr/bin/ide && \
    chmod 755 /home/ubuntu/c9v3/install.sh && \
    chmod 755 /home/ubuntu/c9v3/server.js

RUN curl -sL https://deb.nodesource.com/setup | bash - && \ 
    apt-get install nodejs -y

RUN rm /home/ubuntu/.dropbox50

ADD ./files/dropbox /home/ubuntu/

USER ubuntu

RUN ide install