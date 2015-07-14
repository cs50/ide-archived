IMG_WKSPC=workspace
IMG_IDE=ide50
IMG_OFF=ide50-offline
CON_OFF=cs50ide
IP := $(shell boot2docker ip)

# running
run:
	docker run -e "OFFLINE_IP=$(IP)" -e "OFFLINE_PORT=8080" \
		   --name $(CON_OFF) -d \
		   -p 5050:5050 -p 8080:8080 $(IMG_OFF) 2>/dev/null \
	|| docker start $(CON_OFF)

open:
	open http://$(IP):5050/ide.html

shell: run
	docker exec -it $(CON_OFF) /bin/bash

stop:
	docker stop $(CON_OFF)

# building
wkspc:
	docker build -t $(IMG_WKSPC) $(IMG_WKSPC)

ide:
	docker build -t $(IMG_IDE) $(IMG_IDE)

offline:
	git clone git@github.com:cs50/ide50-plugin.git ide50-offline/files/ide50-plugin || true
	docker build -t $(IMG_OFF) $(IMG_OFF)

build: wkspc ide offline

# removal
clean:
	rm -r ide50-offline/files/ide50-plugin || true
	docker rm $(CON_OFF)
	docker rmi $(IMG_OFF)

