all: server client

.PHONY: server client

server:
	$(MAKE) -C server

client:
	$(MAKE) -C client


run_server:
	$(MAKE) -C server dev

run_client:
	$(MAKE) -C client dev
