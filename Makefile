DATA_DIR ?= /data/movie

default: build

setup:
	pnpm install

build: setup
	pnpm run build

build_production: setup
	NODE_ENV=production pnpm run build

dev:
	pnpm run serve

server: setup
	ncc build server.js -o server

serve:
	node server/index.js --data $(DATA_DIR)
