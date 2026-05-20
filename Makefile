.PHONY: all build ci lint test templates

all: lint test build

build: templates
	npm run build

templates:
	npx tsx scripts/export-templates.ts

lint:
	npx biome check --fix .
	npx tsc --noEmit

test-code:
	npx vitest run --exclude tests/cocked.test.ts --exclude tests/fairness.test.ts --exclude tests/throws.test.ts

test-all:
	npm test

test: lint test-code

ci: lint test-all
