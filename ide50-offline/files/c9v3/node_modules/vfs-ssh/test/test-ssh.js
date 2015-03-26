var Master = require('vfs-ssh').Master;

console.log(Master);

var master = new Master({
  root: "/home/tim/",
  host: "tim@creationix.com",
  nodePath: "/home/tim/nvm/v0.8.4/bin/node"
});

console.log("connecting...");
master.connect(function (err, vfs) {
  if (err) throw err;
  console.log("Connected", vfs);
  setTimeout(function () {
    console.log("disconnecting...");
    master.disconnect();
  }, 1000);
});