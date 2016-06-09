IMG_WKSPC=workspace
IMG_IDE=ide50
IMG_OFF=ide50-offline-big
IMG_SQU=ide50-offline
CON_OFF=cs50ide
IP := $(shell docker-machine ip)

# pick right tool for opening IDE in browser
ifeq ($(shell uname), Linux)
    OPEN=xdg-open
else
    OPEN=open
endif

# running (you can override with, eg, `make run image="cs50/ide50-offline"`
image="ide50-offline-big"
run:
	docker run -e "OFFLINE_IP=$(IP)" -e "OFFLINE_PORT=8080" \
		   --name $(CON_OFF) -d \
		   -p 5050:5050 -p 8080:8080 $(image) 2>/dev/null \
	|| docker start $(CON_OFF)

open:
	$(OPEN) http://$(IP):5050/ide.html

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
	rm -rf ide50-offline/files/harvard.cs50.*
	git clone --depth=1 git@github.com:cs50/harvard.cs50.cat.git ide50-offline/files/harvard.cs50.cat
	git clone --depth=1 git@github.com:cs50/harvard.cs50.info.git ide50-offline/files/harvard.cs50.info
	git clone --depth=1 git@github.com:cs50/harvard.cs50.presentation.git ide50-offline/files/harvard.cs50.presentation
	git clone --depth=1 git@github.com:cs50/harvard.cs50.previewer.git ide50-offline/files/harvard.cs50.previewer
	git clone --depth=1 git@github.com:cs50/harvard.cs50.simple.git ide50-offline/files/harvard.cs50.simple
	git clone --depth=1 git@github.com:cs50/harvard.cs50.theme.git ide50-offline/files/harvard.cs50.theme
	rm -rf ide50-offline/files/harvard.cs50.*/.{git,gitignore}
	docker build -t $(IMG_OFF) ide50-offline

build: wkspc ide offline

# squash
squash:
	docker save $(IMG_OFF) | sudo docker-squash -t $(IMG_SQU) | docker load

# removal
clean: stop
	rm -rf ide50-offline/files/harvard.cs50.* || true
	docker rm $(CON_OFF) || true
	docker rmi $(IMG_SQU) || true
	docker rmi $(IMG_OFF) || true

