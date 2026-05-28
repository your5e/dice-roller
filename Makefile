.PHONY: all build ci lint templates test test-bundle test-code test-slow

SLOW_TESTS := tests/fairness.test.ts tests/throws.test.ts
BUILD_TESTS := tests/bundle.test.ts
EXCLUDE_TESTS := $(BUILD_TESTS) $(SLOW_TESTS)

all: lint test build

build: templates
	npm run build
	$(MAKE) test-bundle

ci: lint test-code test-slow build

lint:
	npx biome check --fix .
	npx tsc --noEmit

templates:
	npx tsx scripts/export-templates.ts

test: lint test-code

test-bundle:
	npx vitest run $(BUILD_TESTS)

test-code:
	npx vitest run $(foreach t,$(EXCLUDE_TESTS),--exclude $(t))

test-slow:
	npx vitest run $(SLOW_TESTS)
