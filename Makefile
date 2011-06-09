test-tmp:
	@rm -rf test/tmp
	@mkdir -p test/tmp

test: 
	expresso -I lib test/unit/*.js  test/acceptance/*.js

test-cov: 
	expresso -I lib --cov test/unit/*.js test/acceptance/*.js

.PHONY: test test-cov
