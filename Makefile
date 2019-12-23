SHELL=/bin/bash

all:
	npm install

clean:
	rm -rf node_modules/*

check:
	npm test

eslint:
	@echo "***eslint***"
	@./node_modules/.bin/eslint lib/**/*.js test/**/*.js app.js

TEST_SUITE := $(shell find test/{unit,integration,acceptance} -name "*.js")
TEST_SUITE_UNIT := $(shell find test/unit -name "*.js")
TEST_SUITE_INTEGRATION := $(shell find test/integration -name "*.js")
TEST_SUITE_ACCEPTANCE := $(shell find test/acceptance -name "*.js")
TEST_SUITE_BATCH := $(shell find test/*/batch -name "*.js")

test:
	@echo "***tests***"
	@$(SHELL) test/run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE)

test-unit:
	@echo "***unit tests***"
	@$(SHELL) test/run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE_UNIT)

test-integration:
	@echo "***integration tests***"
	@$(SHELL) test/run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE_INTEGRATION)

test-acceptance:
	@echo "***acceptance tests***"
	@$(SHELL) test/run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE_ACCEPTANCE)

test-batch:
	@echo "***batch queries tests***"
	@$(SHELL) test/run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE_BATCH)

test-all: test eslint

coverage:
	@RUNTESTFLAGS=--with-coverage make test

.PHONY: test coverage
