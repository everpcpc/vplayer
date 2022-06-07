all: server client

.PHONY: server client


server:
	$(MAKE) -C server

client:
	npm run build
