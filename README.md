SQL API for cartodb.com
========================
 
Provides a nodejs based API for running SQL queries against CartoDB.

* Users are authenticated over OAuth. Also provides ability to make public
  "SELECT" only calls.
* OAuth requests to this API should always be made over SSL.


core requirements
-------------
* pg_bouncer
* postgres
* redis
* node v0.4.8+
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


dependencies
------------

```bash
npm install
```


tests
-----
``` bash
npm test-unit
npm test-acceptance
```

make sure you have setup your database connections in /config, and
have the correct databases and keys setup in redis.  You'll at least
need to set redis with `HSET rails:oauth_tokens:1 user_id 1` for the
acceptance tests.
