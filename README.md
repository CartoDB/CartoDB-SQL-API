SQL API for cartodb.com
========================

[![Build Status](https://travis-ci.org/CartoDB/CartoDB-SQL-API.png?branch=master)](https://travis-ci.org/CartoDB/CartoDB-SQL-API)

Provides a node.js based API for running SQL queries against CartoDB.

* Users are authenticated over OAuth or via an API KEY.
* Authenticated requests to this API should always be made over SSL.


core requirements
-----------------
* postgres 9.0+ (with plpythonu extension for ``CDB_QueryTables``)
* postgis 2.0+
* GDAL 1.9.2+ (bin utils)
* zip commandline tool
* redis
* node >=0.8.18
* npm >=1.2.1


Install dependencies
--------------------

```sh
npm install
```


usage
-----

Create and edit config/environments/<environment>.js from .js.example files.
You may find the ./configure script useful to make an edited copy for you,
see ```./configure --help``` for a list of supported switches.

Make sure redis is running and knows about active cartodb user.

Make sure your PostgreSQL server is running, is accessible on
the host and port specified in the <environment> file, has
a 'publicuser' role (or whatever you set ``db_pubuser`` configuration
directive to) and trusts user authentication from localhost
connections.

```sh
node app.js <environment>
```

Supported <environment> values are development, test, production

See doc/API.md for API documentation.
For examples of use, see under test/.


tests
-----

Run with:

```sh
npm test
```

If any issue arise see test/README.md

Note that the environment should be set to ensure the default
PostgreSQL user is superuser (PGUSER=postgres make check).
