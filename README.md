# ide50-docker
IDE50's Docker configuration for Cloud9

To install locally:

Run 'boot2docker start'
Once it's loaded, cd to the root of this repo
Run 'docker build workspace'
Change line 1 of ide50/Dockerfile to 'FROM <image>' where <image> is the image docker successfully built for workspace
Run 'docker build ide50'
Run 'docker run -ti <image>' where <image> is the image docker successfully built for ide50
Run tests

To test offline mode/build offline version for distro, run 'docker build ide50-offline'
To test the ide, run 'docker run -ti -p 8080:8080 -p 8081:8081 <image>' 
where <image> is the image docker successfully built for ide50 offline
Then run 'ide run', and go to the ip address that the boot2docker vm is bound to (on 'boot2docker start', an IP will be exported)

To install for cloud9:
Change line 1 of ide50/Dockerfile to 'FROM cloud9/workspace'
Zip ide50
Email to Nikolai Onken, nikolai@c9.io
