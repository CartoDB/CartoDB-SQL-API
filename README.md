SQL API for cartodb.com
========================

Provides a nodejs based API for running SQL queries against CartoDB.

* Users are authenticated over OAuth or via an API KEY.
* Authenticated requests to this API should always be made over SSL.


core requirements
-------------
* postgres 9.0+
* cartodb 0.9.5+ (for CDB_QueryTables)
* redis
* node > v0.4.8 && < v0.9.0
* npm

Install dependencies
---------------------

```bash
npm install
```

usage
-----

Create and edit config/environments/<environment>.js from .js.example files.
You may find the ./configure script useful to make an edited copy for you,
see ```./configure --help``` for a list of supported switches.

Make sure redis is running and knows about active cartodb user.

``` bash
node [cluster.js|app.js] <environment>
```

Supported <environment> values are developement, test, production

for examples of use, see /test


tests
------
see test/README.md


note on 0.4.x
--------------
output of large result sets is slow under node 0.4. Recommend running under 0.6+ where possible.
