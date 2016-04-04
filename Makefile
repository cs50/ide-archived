IMG_WKSPC=workspace
IMG_IDE=ide50
IMG_OFF=ide50-offline-big
IMG_SQU=ide50-offline
CON_OFF=cs50ide
IP := $(shell docker-machine ip)

# running
run:
	docker run -e "OFFLINE_IP=$(IP)" -e "OFFLINE_PORT=8080" \
		   --name $(CON_OFF) -d \
		   -p 5050:5050 -p 8080:8080 $(IMG_OFF) 2>/dev/null \
	|| docker start $(CON_OFF)

run-squash:
	docker run -e "OFFLINE_IP=$(IP)" -e "OFFLINE_PORT=8080" \
		   --name $(CON_OFF) -d \
		   -p 5050:5050 -p 8080:8080 $(IMG_SQU) 2>/dev/null \
	|| docker start $(CON_OFF)

open:
	open http://$(IP):5050/ide.html

shell: run
	docker exec -it $(CON_OFF) /bin/bash

restart:
	docker restart $(CON_OFF) || true

stop:
	docker stop $(CON_OFF) || true

# building
wkspc:
	docker build -t $(IMG_WKSPC) $(IMG_WKSPC)

ide:
	docker build -t $(IMG_IDE) $(IMG_IDE)

offline:
	rm -rf ide50-offline/files/ide50-plugin
	mkdir -p ide50-offline/files/ide50-plugin
	git clone --depth=1 git@github.com:cs50/ide50-plugin.git ide50-offline/files/ide50-plugin
	rm -rf ide50-offline/files/ide50-plugin/README.md
	rm -rf ide50-offline/files/ide50-plugin/.git*
	docker build -t $(IMG_OFF) ide50-offline

build: wkspc ide offline

# squash
squash:
	docker save $(IMG_OFF) | sudo docker-squash -t $(IMG_SQU) | docker load

# removal
clean: stop
	rm -rf ide50-offline/files/ide50-plugin || true
	docker rm $(CON_OFF) || true
	docker rmi $(IMG_SQU) || true
	docker rmi $(IMG_OFF) || true

