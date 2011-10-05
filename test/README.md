cartodb-sql-api tests
--

* Tests require you create a test database, execute prepare_db.sh. You need postgres and redis running

once database is configured, run the tests with expresso:

> expresso test/acceptance/app.test.js
