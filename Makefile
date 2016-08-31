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

.PHONY:	docker/start
docker/start: docker/build docker/sync-time
	DEBUG=$(DEBUG) docker-compose run --rm --service-ports app

.PHONY: start
start:
	npm install
	DEBUG=$(DEBUG) npm start
