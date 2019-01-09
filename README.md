SQL API for carto.com
========================

[![Build Status](https://travis-ci.org/CartoDB/CartoDB-SQL-API.png?branch=master)](https://travis-ci.org/CartoDB/CartoDB-SQL-API)

Provides a node.js based API for running SQL queries against CartoDB.

* Users are authenticated over OAuth or via an API KEY.
* Authenticated requests to this API should always be made over SSL.


core requirements
-----------------
* Node >= 10.14.2 or 6.9.2
* npm >= 6.4.1 || 3.10.9 || 3.10.10
* Postgres `9.3+`.
* Postgis `2.2`.
* [CartoDB Postgres Extension](https://github.com/CartoDB/cartodb-postgresql/blob/0.19.2/README.md) `0.19+`.
* GDAL `1.11.0` (bin utils). See [installing GDAL](http://trac.osgeo.org/gdal/wiki/DownloadingGdalBinaries)
* zip commandline tool.
* Redis `3`, recommended reversion `3.0.2`.


Install dependencies
--------------------

- Node.js >= 10.14.2:
```
$ mv npm-shrinkwrap.json npm-shrinkwrap.json.backup
$ npm ci
$ mv npm-shrinkwrap.json.backup npm-shrinkwrap.json
```

- Node.js 6.9.2:
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

Contributing
---

See [CONTRIBUTING.md](CONTRIBUTING.md).
