all:
	npm install

clean:
	rm -rf node_modules/*

check:
	npm test

jshint:
	@echo "***jshint***"
	@./node_modules/.bin/jshint app/ test/ app.js

test:
	@echo "***tests***"
	test/run_tests.sh ${RUNTESTFLAGS} test/unit/*.js test/unit/model/*.js test/acceptance/*.js  test/acceptance/export/*.js

test-unit:
	@echo "***unit tests***"
	test/run_tests.sh ${RUNTESTFLAGS} test/unit/*.js test/unit/model/*.js

test-acceptance:
	@echo "***acceptance tests***"
	test/run_tests.sh ${RUNTESTFLAGS} test/acceptance/*.js  test/acceptance/export/*.js

test-all: jshint test

.PHONY: test
