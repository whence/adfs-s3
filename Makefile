.PHONY:	tools
tools:
	@which docker > /dev/null
	@which docker-compose > /dev/null

.PHONY: sync-time
sync-time: tools
	docker run -it --rm --privileged alpine date -u $(shell date -u +%m%d%H%M%Y)

.PHONY:	update
update: tools sync-time
	docker-compose build

.PHONY:	console
console: update
	docker-compose run --rm app /bin/bash

.PHONY:	start
start: update
	docker-compose run --rm --service-ports app

.PHONY:	clean
clean: tools
	docker-compose stop
	docker-compose rm -f -v

.PHONY: start_local
start_local:
	npm install
	npm start
