# CartoDB-SQL-API [![Build Status](https://travis-ci.org/CartoDB/CartoDB-SQL-API.svg?branch=master)](https://travis-ci.org/CartoDB/CartoDB-SQL-API)

The [`CARTO SQL API`](https://carto.com/developers/sql-api/). Provides a web service for running SQL queries and jobs against your account in CARTO:

* Run queries with fine-grained permissions through [`Auth API`](https://carto.com/developers/auth-api/).
* Export data in multiple geospatial formats (CVS, geopackage, KML, SHP, spatialite, geojson, topojson, etc).
* Schedule jobs using [`Batch Queries`](https://carto.com/developers/sql-api/guides/batch-queries/).
* [Copy queries](https://carto.com/developers/sql-api/guides/copy-queries/) allow you to use the [PostgreSQL copy command](https://www.postgresql.org/docs/10/static/sql-copy.html) for efficient streaming of data to and from CARTO.

## Build

Requirements:

* [`Node 10.x (npm 6.x)`](https://nodejs.org/dist/latest-v10.x/)
* [`PostgreSQL >= 10.0`](https://www.postgresql.org/download/)
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

Create the `./config/environments/<env>.js` file (there are `.example` files to start from). Look at `./lib/server-options.js` for more on config.

```shell
$ node app.js <env>
```

Where `<env>` is the name of a configuration file under `./config/environments/`.

### Test

```shell
$ npm test
```

### Coverage

```shell
$ npm run cover
```

Open `./coverage/lcov-report/index.html`.

### Docker support

We provide docker images just for testing and continuous integration purposes:

* [`nodejs-xenial-pg1121`](https://hub.docker.com/r/carto/nodejs-xenial-pg1121/tags)
* [`nodejs-xenial-pg101`](https://hub.docker.com/r/carto/nodejs-xenial-pg101/tags)

You can find instructions to install Docker, download, and update images [here](https://github.com/CartoDB/Windshaft-cartodb/blob/master/docker/reference.md).

### Useful `npm` scripts

Run test in a docker image with a specific Node.js version:

```shell
$ DOCKER_IMAGE=<docker-image-tag> NODE_VERSION=<nodejs-version> npm run test:docker
```

Where:

* `<docker-image-tag>`: the tag of required docker image, e.g. `carto/nodejs-xenial-pg1121:latest`
* `<nodejs-version>`: the Node.js version, e.g. `10.15.1`

In case you need to debug:

```shell
$ DOCKER_IMAGE=<docker-image-tag> npm run docker:bash
```

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
