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

usage
-----

Edit config/environments/<environment>.js
Make sure redis is running and knows about active cartodb user.

``` bash
node [cluster.js|app.js] <environment>
```

Supported <environment> values are developement, test, production

for examples of use, see /tests


Install dependencies
---------------------

```bash
npm install
```


tests
------
see test/README.md


note on 0.4.x
--------------
output of large result sets is slow under node 0.4. Recommend running under 0.6 where possible.
