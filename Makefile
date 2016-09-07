DEBUG = s3,adfs,express

.PHONY: docker/sync-time
docker/sync-time:
	@docker run -it --rm --privileged alpine date -u $(shell date -u +%m%d%H%M%Y)

.PHONY:	docker/build
docker/build:
	docker-compose build

.PHONY:	docker/console
docker/console: docker/build docker/sync-time
	docker-compose run --rm app /bin/bash

.PHONY: build
build:
	npm install
	npm run clean
	npm run build

.PHONY: start
start: build
	DEBUG=$(DEBUG) npm start
