.PHONY: all build lint test templates

all: lint test build

build: templates
	npm run build

templates:
	npx tsx scripts/export-templates.ts

lint:
	npx biome check --fix .
	npx tsc --noEmit

test-code:
	npm test

test: lint test-code
