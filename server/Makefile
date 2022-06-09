DATA_DIR ?= /data/movie

default: build

setup:
	npm install

build: setup
	ncc build index.js -o dist

dev:
	node dist/index.js --data $(DATA_DIR)
