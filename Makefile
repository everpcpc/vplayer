all: server client

.PHONY: server client


server:
	$(MAKE) -C server

setup:
	npm install

client: setup
	npm run build
