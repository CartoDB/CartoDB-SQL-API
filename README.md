# CartoDB-SQL-API [![Build Status](https://travis-ci.org/CartoDB/CartoDB-SQL-API.svg?branch=master)](https://travis-ci.org/CartoDB/CartoDB-SQL-API)

The [`CARTO’s SQL API`](https://carto.com/developers/sql-api/) allows you to interact with your data inside CARTO, as if you were running SQL statements against a normal database.

* Run queries with fine-grained permissions through [`Auth API`](https://carto.com/developers/auth-api/).
* Export data in multiple geospatial formats (CVS, geopackage, KML, SHP, spatialite, geojson, topojson, etc).
* Schedule jobs using [`Batch Queries`](https://carto.com/developers/sql-api/guides/batch-queries/).
* [`Copy queries`](https://carto.com/developers/sql-api/guides/copy-queries/) allows you to use the [`PostgreSQL copy command`](https://www.postgresql.org/docs/10/static/sql-copy.html) for efficient streaming of data to and from CARTO.

## Build

Requirements:

* [`Node 12.x`](https://nodejs.org/dist/latest-v12.x/)
* [`PostgreSQL >= 11.0`](https://www.postgresql.org/download/)
* [`PostGIS >= 2.4`](https://postgis.net/install/)
* [`CARTO Postgres Extension >= 0.24.1`](https://github.com/CartoDB/cartodb-postgresql)
* [`Redis >= 4`](https://redis.io/download)
* GDAL `1.11.0` (bin utils). See [installing GDAL](http://trac.osgeo.org/gdal/wiki/DownloadingGdalBinaries)
* `C++11` to build internal dependencies. When there's no pre-built binaries for your OS/architecture distribution.

Optional:

* [`Varnish`](http://www.varnish-cache.org)
* [`Statsd`](https://github.com/statsd/statsd)

### PostGIS setup

A `template_postgis` database is expected. One can be set up with

```shell
$ createdb --owner postgres --template template0 template_postgis
$ psql -d template_postgis -c 'CREATE EXTENSION postgis;'
```

### Install

To fetch and build all node-based dependencies, run:

```shell
$ npm install
```

### Run

You can inject the configuration through environment variables at run time. Check the file `./config/environments/config.js` to see the ones you have available.

While the migration to the new environment based configuration, you can still use the old method of copying a config file. To enabled the one with environment variables you need to pass `CARTO_SQL_API_ENV_BASED_CONF=true`. You can use the docker image to run it.

Old way:

```shell
$ node app.js <env>
```

Where `<env>` is the name of a configuration file under `./config/environments/`.

### Test

```shell
$ npm test
```

You can try to run the tests against the dependencies from the `dev-env`. To do so, you need to build the test docker image:

```shell
$ docker-compose -f private/docker-compose.yml build
```

Then you can run the tests like:

```shell
$ docker-compose -f private/docker-compose.yml  run sql-api-tests
```

It will mount your code inside a volume. In case you want to play and run `npm test` or something else you can do:

```shell
$ docker-compose -f private/docker-compose.yml run --entrypoint bash sql-api-tests
```

So you will have a bash shell inside the test container, with the code from your host.

⚠️ *WARNING* Some tests still fail inside the docker environment. Inside CI they don't yet use the `ci` folder to run the tests either. There is a failing test which prevents it.

### Coverage

```shell
$ npm run cover
```

Open `./coverage/lcov-report/index.html`.

## Documentation

You can find an overview, guides, full reference, and support in [`CARTO's developer center`](https://carto.com/developers/sql-api/). The [docs directory](https://github.com/CartoDB/CartoDB-SQL-API/tree/master/docs) contains different documentation resources, from a higher level to more detailed ones.

## Contributing

* The issue tracker: [`Github`](https://github.com/CartoDB/CartoDB-SQL-API/issues).
* We love Pull Requests from everyone, see [contributing to Open Source on GitHub](https://guides.github.com/activities/contributing-to-open-source/#contributing).
* You'll need to sign a Contributor License Agreement (CLA) before submitting a Pull Request. [Learn more here](https://carto.com/contributions).

## Versioning

We follow [`SemVer`](http://semver.org/) for versioning. For available versions, see the [tags on this repository](https://github.com/CartoDB/CartoDB-SQL-API/tags).

## License

This project is licensed under the BSD 3-clause "New" or "Revised" License. See the [LICENSE](LICENSE) file for details.
