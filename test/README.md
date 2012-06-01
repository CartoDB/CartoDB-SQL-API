cartodb-sql-api tests
---------------------
Tests require you create a test database and set some redis keys before,
you can execute prepare_db.sh script, it will create database, users
and redis stuff for you. Be sure postgres and redis are running

> cd test && ./prepare_db.sh


Acceptance tests (need ctrl-C to exit)
--------------------------------------
> expresso test/acceptance/app.test.js
> expresso test/acceptance/app.auth.test.js


Unit tests
----------

> expresso test/unit/psql.tests.js