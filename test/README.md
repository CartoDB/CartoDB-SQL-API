cartodb-sql-api tests
---------------------
Tests require you create a test database and set some redis keys before,
you can execute prepare_db.sh script, it will create database, users
and redis stuff for you. Be sure postgres and redis are running.

> cd test && ./prepare_db.sh

Note that "make check" from top-level dir will try to do everything
needed to prepare & run the tests.


Acceptance tests (need ctrl-C to exit)
--------------------------------------
> mocha -u tdd test/acceptance/app.test.js
> mocha -u tdd test/acceptance/app.auth.test.js


Unit tests 
--------------------------------
> mocha -u tdd test/unit/*.js (or run the tests individually)
