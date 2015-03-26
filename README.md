# ide50-docker
IDE50's Docker configuration for Cloud9

#To install locally:

1. Run 'boot2docker start'
2. Once it's loaded, cd to the root of this repo
3. Run 'docker build workspace'
4. Change line 1 of ide50/Dockerfile to 'FROM <image>' where <image> is the image docker successfully built for workspace
5. Run 'docker build ide50'
6. Run 'docker run -ti <image>' where <image> is the image docker successfully built for ide50
7. Run tests

8. To test offline mode/build offline version for distro, run 'docker build ide50-offline'
9. To test the ide, run 'docker run -ti -p 8080:8080 -p 8081:8081 <image>' 
where <image> is the image docker successfully built for ide50 offline
10. Then run 'ide run', and go to the ip address that the boot2docker vm is bound to (on 'boot2docker start', an IP will be exported)

#To install for cloud9:
1. Change line 1 of ide50/Dockerfile to 'FROM cloud9/workspace'
2. Zip ide50
3. Email to Nikolai Onken, nikolai@c9.io
