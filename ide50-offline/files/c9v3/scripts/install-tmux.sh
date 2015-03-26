curl -OL http://downloads.sourceforge.net/tmux/tmux-1.9.tar.gz
curl -OL http://downloads.sourceforge.net/project/levent/libevent/libevent-2.0/libevent-2.0.21-stable.tar.gz

# Unpack the sources

tar xzf tmux-1.9.tar.gz
tar xzf libevent-2.0.21-stable.tar.gz

# Compiling libevent

cd libevent-2.0.21-stable
./configure --prefix=/opt
make
sudo make install

# Compiling tmux

cd ../tmux-1.9
LDFLAGS="-L/opt/lib" CPPFLAGS="-I/opt/include" LIBS="-lresolv" ./configure --prefix=/opt
make
sudo make install
