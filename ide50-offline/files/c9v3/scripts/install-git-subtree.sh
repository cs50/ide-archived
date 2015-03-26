cd ~
wget http://hydra.nixos.org/build/5350088/download/1/nix-1.5.3-i686-linux.tar.bz2
cd /
sudo tar xvfj ~/nix-1.5.3-i686-linux.tar.bz2
sudo chown -R ubuntu:ubuntu /nix
nix-finish-install
rm ~/nix-1.5.3-i686-linux.tar.bz2
echo 'source /home/ubuntu/.nix-profile/etc/profile.d/nix.sh' >> ~/.profile
source ~/.profile
nix-channel --add http://nixos.org/channels/nixpkgs-unstable
nix-channel --update
nix-env -i git git-subtree
