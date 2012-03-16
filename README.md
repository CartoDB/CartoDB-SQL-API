SQL API for cartodb.com
========================
 
Provides a nodejs based API for running SQL queries against CartoDB.

* Users are authenticated over OAuth. Also provides ability to make public
  "SELECT" only calls.
* OAuth requests to this API should always be made over SSL.


core requirements
-------------
* postgres
* redis
* node v0.4.8+
* npm

usage
-----

Make sure redis is running and knows about active cartodb user.

``` bash
node [cluster.js|app.js] [developement|test|production]
```

for examples of use, see /tests


Install dependencies
---------------------

```bash
npm install
```


tests
------
see test/README.md
