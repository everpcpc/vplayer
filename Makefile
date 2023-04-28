DATA_DIR ?= /data/movie

default: build

setup:
	pnpm install

build: setup
	pnpm build

build_production: setup
	NODE_ENV=production pnpm build

dev:
	pnpm serve

server: setup
	pnpm build-server

serve:
	node server/index.js --data $(DATA_DIR)
