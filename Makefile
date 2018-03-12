IMG_WKSPC=workspace
IMG_IDE=cs50/ide
CON_OFF=ide50
IP := 127.0.0.1

PLUGINS := audioplayer browser cat debug gist hex info presentation simple statuspage theme

# pick right tool for opening IDE in browser
ifeq ($(shell uname), Linux)
    OPEN=xdg-open
else
    OPEN=open
endif

define getplugin
	@echo "\nFetching $(1)..."
	@plugin_dir="files/plugins/c9.ide.cs50.$(1)"; \
	mkdir -p "$$plugin_dir"; \
	git clone --depth=1 "git@github.com:cs50/harvard.cs50.$(1).git" "$$plugin_dir"; \
	rm -rf "$$plugin_dir/README.md" "$$plugin_dir/.git"*

endef

run:
	docker run -e "IP=$(IP)" -e "PORT=8080" \
		--name $(CON_OFF) -d -t \
		--security-opt seccomp=unconfined \
		-p 5050:5050 -p 8080:8080 -p 8081:8081 -p 8082:8082 \
		$(IMG_IDE) 2>/dev/null \
	|| docker start $(CON_OFF)

open:
	$(OPEN) http://$(IP):5050/ide.html >/dev/null 2>&1

shell: run
	docker exec -it $(CON_OFF) /bin/bash

restart:
	docker restart $(CON_OFF) || true

stop:
	docker stop $(CON_OFF) || true

build:
	rm -rf files/plugins
	mkdir files/plugins
	$(foreach plugin,$(PLUGINS),$(call getplugin,$(plugin)))
	rm -rf files/plugins/*/.{git,gitignore}
	docker build --no-cache -t $(IMG_IDE) .

# removal
clean: stop
	rm -rf files/plugins || true
	docker rm $(CON_OFF) || true
	docker rmi $(IMG_IDE) || true

