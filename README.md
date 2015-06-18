# ide50-docker
IDE50's Docker configuration for Cloud9

#To install locally:

1. Install boot2docker.
1. Run boot2docker (or in a Terminal, type <tt>boot2docker start</tt>)
1. Once it's loaded, cd to the root of this repo
1. Run <tt>docker build workspace</tt>
1. Change line 1 of ide50/Dockerfile to <tt>FROM IMAGE-WKSPC</tt> where 
   <tt>IMAGE-WKSPC</tt> is the successfully built workspace image ID.
1. Run <tt>docker build ide50</tt>
1. Run <tt>docker run -ti IMAGE-IDE50</tt> where <tt>IMAGE-IDE50</tt> 
   is the successfully created ide50 image ID.
1. Run tests
1. To test offline mode/build offline version for distro, run 
   <tt>docker build ide50-offline</tt>
1. To test the ide, run <tt>docker run -e "C9_HOSTNAME:$(boot2docker ip)" 
   --name cs50ide -d -p 5050:5050 -p 8080:8080 IMAGE-OFFLINE</tt>
   where <tt>IMAGE-OFFLINE</tt> is the successfully built ide50-offline ID.
1. Then run <tt>ide run</tt>, and go to the ip address that the 
   boot2docker vm is bound to (on <tt>boot2docker start</tt>, an 
   IP will be exported)

#To install for cloud9:
1. Change line 1 of ide50/Dockerfile to 'FROM cloud9/workspace'
2. Zip ide50 (<tt>zip -r ide50 ide50</tt>).
3. Email to Nikolai Onken, nikolai@c9.io
