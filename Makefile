IMG_WKSPC=workspace
IMG_IDE=ide50
IMG_OFF=ide50-offline-big
IMG_SQU=ide50-offline
CON_OFF=ide50
IP := 127.0.0.1

PLUGINS := audioplayer cat debug gist hex info presentation simple theme

# pick right tool for opening IDE in browser
ifeq ($(shell uname), Linux)
    OPEN=xdg-open
else
    OPEN=open
endif

define getplugin
	@echo "\nFetching $(1)..."
	@plugin_dir="ide50-offline/files/plugins/c9.ide.cs50.$(1)"; \
	mkdir -p "$$plugin_dir"; \
	git clone --depth=1 "git@github.com:cs50/harvard.cs50.$(1).git" "$$plugin_dir"; \
	rm -rf "$$plugin_dir/README.md" "$$plugin_dir/.git"*

endef

# running (you can override with, eg, `make run image="cs50/ide50-offline"`
image="ide50-offline-big"
run:
	docker run -e "OFFLINE_IP=$(IP)" -e "OFFLINE_PORT=8080" \
		--name $(CON_OFF) -d -t \
		--security-opt seccomp=unconfined \
		-p 5050:5050 -p 8080:8080 -p 8081:8081 -p 8082:8082 \
		$(image) 2>/dev/null \
	|| docker start $(CON_OFF)

open:
	$(OPEN) http://$(IP):5050/ide.html >/dev/null 2>&1

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
	rm -rf ide50-offline/files/plugins
	mkdir ide50-offline/files/plugins
	$(foreach plugin,$(PLUGINS),$(call getplugin,$(plugin)))
	rm -rf ide50-offline/files/plugins/*/.{git,gitignore}
	docker build -t $(IMG_OFF) ide50-offline

build: wkspc ide offline

# squash
squash:
	# be sure to build docker-squash with support for the new manifest:
	# https://github.com/jwilder/docker-squash/pull/55
	# This may help, if the PR isn't yet merged:
	# https://stackoverflow.com/questions/27567846/how-can-i-checkout-a-github-pull-request
	docker save $(IMG_OFF) | sudo docker-squash -t $(IMG_SQU):latest | docker load

# removal
clean: stop
	rm -rf ide50-offline/files/plugins || true
	docker rm $(CON_OFF) || true
	docker rmi $(IMG_SQU) || true
	docker rmi $(IMG_OFF) || true

