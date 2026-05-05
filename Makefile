.PHONY: all build lint test

all: lint test build

build:
	npm run build

lint:
	npx biome check .
	npx tsc --noEmit

test-code:
	npm test

test: lint test-code
