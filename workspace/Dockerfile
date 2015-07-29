FROM ubuntu:trusty
MAINTAINER Fabian Jakobs <fabian@c9.io>

ENV DEBIAN_FRONTEND noninteractive

# increment version to force flushing the cache
RUN echo "Version 1.7"

RUN apt-get update
RUN apt-get -y dist-upgrade
RUN apt-get install -y console-setup sudo wget curl git python software-properties-common man-db && \
    echo "install console-setup" && \
    echo "console-setup   console-setup/codeset47 select  # Latin1 and Latin5 - western Europe and Turkic languages" | debconf-set-selections && \
    echo "console-setup   console-setup/fontface47        select  Fixed" | debconf-set-selections && \
    echo "console-setup   console-setup/fontsize-text47   select  16" | debconf-set-selections && \
    echo "console-setup   console-setup/charmap47 select  UTF-8" | debconf-set-selections && \
    echo "keyboard-configuration  console-setup/detect    detect-keyboard" | debconf-set-selections && \
    echo "keyboard-configuration  console-setup/detected  note" | debconf-set-selections && \
    echo "console-setup   console-setup/codesetcode       string  Lat15" | debconf-set-selections && \
    echo "keyboard-configuration  console-setup/ask_detect        boolean false" | debconf-set-selections && \
    echo "console-setup   console-setup/store_defaults_in_debconf_db      boolean true" | debconf-set-selections && \
    echo "console-setup   console-setup/fontsize-fb47     select  16" | debconf-set-selections && \
    echo "console-setup   console-setup/fontsize  string  16" | debconf-set-selections && \
    echo "Create user and enable root access" && \
    useradd --uid 1000 --shell /bin/bash -m --home-dir /home/ubuntu ubuntu && \
    chmod 777 /tmp && \
    sed -i 's/%sudo\s.*/%sudo ALL=NOPASSWD:ALL/' /etc/sudoers && \
    usermod -a -G sudo ubuntu

# apt-get update because ubuntu caches go out of date in a matter of days
RUN apt-get update

# editors
-RUN apt-get install -y vim emacs

# servers
RUN apt-get install -y mysql-server phpmyadmin
RUN apt-get install -y apache2 php5 php5-mcrypt

# tools
RUN apt-get install -y apt-file nano tmux strace ltrace gdb valgrind zip bash-completion tree wget

# Python
RUN apt-get install -y python python-dev python-pip python-setuptools

# shellshock
# TODO: move upward if other things at the top of this file have changed
RUN sudo apt-get update; sudo apt-get install bash

# apt-file cache
RUN apt-file update

# all changes go down here:
# RUN ...

# setup the system
RUN echo -n "" > /etc/motd && \
    echo "export PATH=/bin:/usr/bin:/sbin:/usr/sbin:/user/local/bin:/user/local/sbin" >> /root/.bashrc && \
    sudo -i -u ubuntu HOME=/home/ubuntu bash -i /etc/bash_completion && \
    HOME=/root bash -l /etc/bash_completion

ADD ./files/etc /etc
ADD ./files/home/ubuntu /tmp/homedir
RUN cp /tmp/homedir/.gitignore /tmp/homedir/.hgignore && \
    mkdir -p /tmp/homedir/lib/apache2/lock /tmp/homedir/lib/apache2/log /tmp/homedir/lib/apache2/run && \
    chown -R ubuntu:ubuntu /tmp/homedir && \
    bash -c "shopt -s dotglob && cp -a /tmp/homedir/* /home/ubuntu" && \
    rm -rf /tmp/homedir && \
    echo "Configure apache2" && \
    sudo a2enmod rewrite && \
    sudo sed -i 's/Listen 80\b/Listen 8080/' /etc/apache2/ports.conf && \
    ln -s /etc/apache2/sites-available/001-cloud9.conf /etc/apache2/sites-enabled && \
    chmod 644 /etc/apache2/sites-available/001-cloud9.conf && \
    chown -R ubuntu:ubuntu /home/ubuntu/lib && \
    chown root:root /etc/profile.d/cloud9.sh /etc/apache2/envvars && \
    chmod 644 /etc/profile.d/cloud9.sh /etc/apache2/envvars && \
    sudo -u ubuntu -i bash -c "mkdir -p /home/ubuntu/.ssh" && \
    sed -Ei 's/(.*)secure_path.*/\1!secure_path/' /etc/sudoers && \
    touch /etc/init.d/systemd-logind && \
    cp /bin/true /bin/sync

# re-enable service startup. This line must come after all apt-get installs
RUN rm -f /usr/sbin/policy-rc.d

CMD /bin/bash -l
