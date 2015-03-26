FROM cloud9/workspace
MAINTAINER Dan Bradley <dan.b.bradley@gmail.com> 

RUN curl -sL https://deb.nodesource.com/setup | bash - 

RUN wget -O - http://mirror.cs50.net/ide50/2015/keyFile | sudo apt-key add -
RUN add-apt-repository "deb http://mirror.cs50.net/ide50/2015/dists/trusty/main/binary-amd64/ /"

RUN apt-get update
RUN apt-get install ide50 -y

RUN rm -rf /home/ubuntu/workspace/deb