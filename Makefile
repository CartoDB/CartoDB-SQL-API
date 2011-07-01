test-tmp:
	@rm -rf test/tmp
	@mkdir -p test/tmp

test: 
	./node_modules/expresso/bin/expresso -I lib test/unit/*.js test/acceptance/*.js
	
test-acceptance:
	./node_modules/expresso/bin/expresso -I lib test/acceptance/*.js	

test-unit: 
	./node_modules/expresso/bin/expresso -I lib test/unit/*.js

test-cov: 
	./node_modules/expresso/bin/expresso -I lib --cov test/unit/*.js test/acceptance/*.js

.PHONY: test test-cov
