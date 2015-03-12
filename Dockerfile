FROM cloud9/workspace
MAINTAINER Dan Bradley <dan.b.bradley@gmail.com> 

ADD ./files/workspace /home/ubuntu/workspace
ADD ./files/cs50 /home/ubuntu/cs50
ADD ./files/bin /usr/bin
ADD ./files/etc /etc/
ADD ./files/opt /opt/

RUN chmod -R g+w /home/ubuntu/workspace && \
    chown -R ubuntu:ubuntu /home/ubuntu
    
RUN apt-get install clang -y

RUN apt-get install whois -y

RUN apt-get install gdbserver -y 

RUN chmod 755 /usr/bin/version50 

RUN wget http://mirror.cs50.net/library50/c/library50-c-5.zip && \ 
    unzip library50-c-5.zip && \
    rm -f library50-c-5.zip && \
    cd library50-c-5 && \
    clang -c -ggdb -std=c99 cs50.c -o cs50.o && \
    ar rcs libcs50.a cs50.o && \
    chmod 0644 cs50.h libcs50.a && \
    mkdir -p /usr/local/include && \
    chmod 0755 /usr/local/include && \
    mv -f cs50.h /usr/local/include && \
    mkdir -p /usr/local/lib && \
    chmod 0755 /usr/local/lib && \
    mv -f libcs50.a /usr/local/lib && \
    cd .. && \
    rm -rf library50-c-5
   
RUN mv /home/ubuntu/cs50/app.sh /etc/profile.d && \
    mv /home/ubuntu/cs50/cs50.conf /etc/apache2/conf-available && \
    ln -s /etc/apache2/conf-available/cs50.conf /etc/apache2/conf-enabled/cs50.conf 

RUN mv /home/ubuntu/cs50/dropbox50 /home/ubuntu/.dropbox50

RUN echo "source /home/ubuntu/.dropbox50" >> /home/ubuntu/.bashrc

RUN curl -sL https://deb.nodesource.com/setup | bash - && \ 
    apt-get install nodejs -y

RUN cd /opt/check50/lib && \
    npm install optimist && \
    npm install async && \
    npm install underscore && \
    npm install request && \
    npm install node-zip && \
    npm install wrench && \
    ln -s /opt/check50/bin/check50 /usr/bin/check50 && \
    chmod 755 /usr/bin/check50 && \
    chmod 755 /opt/check50/bin/*

RUN ln -s /opt/style50/bin/style50 /usr/bin/style50 && \
    chmod 755 /usr/bin/style50 && \
    chmod 755 /opt/style50/bin/* && \
    chmod 755 /opt/style50/opt/* 

RUN rm -rf /home/ubuntu/cs50
