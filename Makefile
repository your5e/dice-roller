.PHONY: all build lint test

all: lint test build

build:
	npm run build

lint:
	npx biome check .

test-code:
	npm test

test: lint test-code
