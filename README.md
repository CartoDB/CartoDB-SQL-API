SQL API for cartodb.com
========================
 
Provides a concurrent event driven interface for running SQL queries against the cartoDB postgres database. Users are authenticated over oAuth. Also provides ability to make public "SELECT" only calls.

usage
------
``` bash
node cluster.js [developement,test,production]
```

tests
------
``` bash
npm test-unit
npm test-acceptance
```

make sure you have setup your database connections in /config, and have the correct databases and keys setup in redis (hint, for redis, you'll need a `HSET rails:oauth_tokens:1 user_id 1` for the acceptance tests)


core requirements
-------------
* pg_bouncer
* postgres
* redis
* node v0.4.8+

node.js dependencies
---------------------
* npm

To install dependencies from package.json:

``` npm install```

deployment
----------
* capistrano on ruby 1.9.2. 

To install dependencies from Gemfile:

```bundle install``` 

ensure after first code deploy to run the dependencies task:

```cap production node:npm_dependencies```

