SHELL := /usr/bin/env bash

uninstall: 
	@PS1=`ps ax | egrep Cloud9.ap[p] | grep node-webkit | grep -v Helper | awk '{ print $$1 }'`
	@if [ $$PS1 ]; then kill $$PS1; fi
	@PS2=`ps ax | egrep "app.nw/server.j[s]" | awk '{ print $$1 }'`
	@if [ $$PS2 ]; then kill $$PS2; fi

	sudo rm -rf /Applications/Cloud9.app
	sudo rm -rf ~/Library/Application\ Support/Cloud9
	sudo rm -rf /Library/Application\ Support/Cloud9

default: node_modules

node_modules node_modules/: .PURPLEPONY
	@[ "`git status --porcelain node_modules/ | grep -Ev '^ D'`" == "" ] \
	   || (git status node_modules; echo; echo Changes in node_modules directory, cannot proceed.; exit 1)
	@echo -e "No local changes detected in node_modules, resetting it"
	rm -rf node_modules
	git checkout node_modules
	npm install

reinstall:
	npm install

test:
	test/run-server-tests.sh
	
static:
	./scripts/makestatic.sh --devel
	
local: local-static-compress local-build-compress local-update local-installer
local-dev: local-static local-build local-install

local-static:
	@if which asepsisctl &>/dev/null; then echo Login to disable asepsis; sudo echo -n ''; fi
	scripts/makelocal.sh --quick

local-static-clean:
	@if which asepsisctl &>/dev/null; then echo Login to disable asepsis; sudo echo -n ''; fi
	rm -Rf build/standalone
	scripts/makelocal.sh --quick

local-static-compress:
	@if which asepsisctl &>/dev/null; then echo Login to disable asepsis; sudo echo -n ''; fi
	rm -Rf build/standalone
	scripts/makelocal.sh --compress --obfuscate

local-build:
	build/build-local.sh

local-build-compress:
	build/build-local.sh --compress --obfuscate

local-update:
	build/build-update.sh

local-update-sign:
	build/sign-update.sh

local-installer:
	build/build-osx-installer.sh

local-win-installer:
	rm -Rf build/standalone
	scripts/makelocal.sh
	build/build-local.sh
	build/build-win-installer.sh

local-win-installer-compress:
	rm -Rf build/standalone
	scripts/makelocal.sh
	build/build-local.sh --compress --obfuscate
	build/build-win-installer.sh

local-install:
	sudo cp -a build/webkitbuilds/releases/Cloud9/mac/Cloud9.app /Applications

standalone: standalone-static-compress standalone-build
	
standalone-static:
	rm -Rf build/standalone
	scripts/makestandalone.sh

standalone-static-compress:
	rm -Rf build/standalone
	scripts/makestandalone.sh --compress

standalone-build:
	./build/build-standalone.sh
	
deploy-docker:
	scripts/build-server.js docker --settings=deploy --branch=deploy-docker --deploy=docker
	
deploy-worker:
	scripts/build-server.js worker --settings=deploy --branch=deploy-docker --deploy=worker

deploy-vfs-prod:
	scripts/build-server.js vfs --settings=deploy --branch=deploy-prod --deploy=vfs

deploy-vfs-staging:
	scripts/build-server.js vfs --settings=beta --branch=deploy-staging --deploy=vfs

deploy-shared:
	$(shell scripts/build-server.js --branch=deploy-docker | tail -n1)/plugins/c9.docker/bin/d9 --deploy publish shared
	gssh -P -f docker-prod d9 preseed
	
deploy-images:
	$(shell scripts/build-server.js --branch=deploy-docker | tail -n1)/plugins/c9.docker/bin/d9 --deploy publish --all
	gssh -P -f docker-prod d9 preseed

deploy-images-onlinedev:
	$(shell scripts/build-server.js --branch=deploy-docker | tail -n1)/plugins/c9.docker/bin/d9 --odev publish --all
	gssh -P -f docker-onlinedev d9 preseed
	
deploy-shared-onlinedev:
	$(shell scripts/build-server.js --branch=deploy-docker | tail -n1)/plugins/c9.docker/bin/d9 --odev publish shared
	gssh -P -f docker-onlinedev d9 preseed

deploy-onlinedev: deploy-sapi-onlinedev deploy-docker-onlinedev 

deploy-docker-onlinedev:
	scripts/build-server.js docker --settings=onlinedev --branch=deploy-docker-onlinedev --deploy=docker
	
deploy-monitor:
	scripts/build-server.js monitor --settings=deploy --branch=deploy-monitor --deploy=monitor

deploy-sapi-onlinedev:
	scripts/build-server.js sapi --settings=onlinedev --branch=deploy-docker-onlinedev --deploy=services

deploy-staging:
	scripts/deploy-staging

.PURPLEPONY: # this is a fake helper target 

.PHONY: test local local-build
