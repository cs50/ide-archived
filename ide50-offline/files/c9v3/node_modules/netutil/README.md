node.js network utils
=====================

provides:

Find the first free port on the server within the given range:

`findFreePort(start, end, hostname, callback)`


Check whether the given port is open:

`isPortOpen(hostname, port, timeout, callback)`


Get the hostname of the current server:

`getHostName(callback)`