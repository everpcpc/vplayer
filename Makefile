DATA_DIR ?= /data/movie

default: build

setup:
	npm install

build: setup
	npm run build

build_production: setup
	NODE_ENV=production npm run build

dev:
	npm run serve

server: setup
	ncc build server.js -o server

serve:
	node server/index.js --data $(DATA_DIR)
