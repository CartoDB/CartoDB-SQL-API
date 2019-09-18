# Changelog

## 4.0.0
Released 2019-mm-dd

Breaking:
* Remove in-memory table cache and `/cachestatus` endpoint.

Announcements:
* Update `cartodb-query-tables` to version [`0.5.0`](https://github.com/CartoDB/node-cartodb-query-tables/releases/tag/0.5.0)
* Cache control header fine tuning. Set a shorter value for "max-age" directive if there is no way to know when to trigger the invalidation.
* Upgrade devel dependency `sqlite3` to version `4.0.6`
* Log queries (https://github.com/CartoDB/CartoDB-SQL-API/pull/574)
* Improve batch-queries draining while exiting the process #582
* Implement a mechanism to short out hung connections in copy-from endpoints.
* Implement POST method for copy-to endpoint.
* Log NOTICE's and WARNING's coming from COPY TO queries.
* Retrieve the exact PG field type information in JSON format responses.
* Middlewarify client abort query checker.
* Middlewarify query controller.
* Set a hard limit on the size of the X-SQLAPI-Log header.
* Update cartodb-psql to 0.14.0 and use the timeout parameter for pg.query.

## 3.0.0
Released 2019-02-22

Breaking changes:
* Drop support for Node.js 6
* Drop support for npm 3
* Drop support for Postgres 9.5
* Drop support for PosGIS 2.2
* Drop support for Redis 3

Announcements:
* Deps:
  * Upgrade `debug` to version 4.1.1
  * Upgrade `express` to version 4.16.4
  * Upgrade `request` to version 2.88.0
* Dev deps:
  * Upgrade `jshint` to version 2.9.7
  * Upgrade `mocha` to version 5.2.0
  * Upgrade `zipfile` to version 0.5.12

## 2.4.0
Released 2019-01-16

Announcements:
 * Update docs: compatible Node.js and npm versions
 * Set platform limits message also on streaming responses
 * Consider cancelled queries as platform limits.
 * Report fine-grained Garbage Collector stats
 * Both query endpoints as the same one in rate limits terms
 * Adding Authorization to Access-Control-Allow-Headers (https://github.com/CartoDB/CartoDB-SQL-API/issues/534)


## 2.3.1
Released 2018-12-23

Bug fixes:
* Update carto-package.json


## 2.3.0
Released 2018-12-26

Announcements:
 * Support Node.js 10
 * Add package-lock.json
 * Configure Travis CI to run docker tests against Node.js 6 & 10 versions
 * Update cartodb-psql to 0.13.1 (type cache depends now on db host)

Bug fixes:
 * Do not use `assert` to throw erros as in Node.js > 6 wraps the original error, the keyword 'throw' does the trick and it's backwards compatible
 * Make all modules to use strict mode semantics.
 * Avoid too long messages in `X-SQLAPI-Errors` header #543


## 2.2.1
Released 2018-09-18

Bug fixes:
  * Errors from zlib while gunzipping (`/sql/copyfrom` compressed requests) are now handled correctly.
  * Ensure exports temporal folder
  * Fix an issue with COPY TO returning paused DB connections to the pool #537


## 2.2.0
Released 2018-07-25

Announcements:
  * Improve error message when the DB query is over the user's limits
  * Updated cartodb-redis to 2.0.1
  * Modify the COPY query limits:
      - Instead of the generic timeout, it now uses a 5h timeout.
      - For COPY FROM, the limit is size-based, up to the remaining DB quota
      - The largest COPY FROM that can be made in a single POST request is limited to 2GB


## 2.1.0
Released 2018-06-13

Notice:
- This release changes the way that authentication works internally. You'll need to run `bundle exec rake carto:api_key:create_default` in your development environment to keep working.

New features:
 * CI tests with Ubuntu Xenial + PostgreSQL 10.1 and Ubuntu Precise + PostgreSQL 9.5
 * Making version 2.0.0 configuration parameters backwards compatible
 * New endpoint for COPY commands

Announcements:
 * Updated carto-psql to 0.12.0
 * [Test] Update sqlite3 to 4.0.0


## 2.0.0
Released 2018-03-22

Breaking changes:
 * Needs Redis v4

Features:
 * Implemented middleware to authenticate users throug the new Authorization System.
 * Upgrades cartodb-redis to 1.0.0
 * Rate limit feature (disabled by default)


## 1.48.1
Released 2018-02-27

Announcements:
 * Added `RESIZE=yes` param to gdal shapefile driver, wich optimizes size of exported shapefiles [#462](https://github.com/CartoDB/CartoDB-SQL-API/pull/462)


## 1.48.0
Released 2018-02-12

Announcements:
 * Change work in progress jobs endpoint from `[..]/job/wip` to `[..]/jobs-wip`
 * Documentation updates for Docs repo issue #840, GPKG Export.
 * Fix SHP exports, now it uses "the_geom" column by default when a dataset has more than one geometry column.
 * Logging all errors
 * Fix Postgres version in travis
 * Fix Python timeout error
 * Upgrades redis-mpool to 0.5.0
 * Upgrades cartodb-redis to 0.15.0


## 1.47.1
Released 2017-08-13

Announcements:
 * Upgrade cartodb-psql to 0.10.1.
 * Content edits to doc/version.md.


## 1.47.0
Released 2017-08-10

Announcements:
 * Now export and query APIs respond with `429 You are over the limits` when a query or export command overcomes the pre-configured user's timeout.


## 1.46.1
Released 2017-07-01

Announcements:
 * Now tableCache evicts keys based on their set time #244


## 1.46.0
Released 2017-06-27

Announcements:
 * Disable tableCache in-memory LRU by default [#422](https://github.com/CartoDB/CartoDB-SQL-API/issues/422)

## 1.45.1
Released 2017-06-27

Bug fixes:
 * Support special float values (NaN and ±Infinity) in query responses


## 1.45.0
Released 2017-04-18

Bug fixes:
 * Add error callback to ogr command while spawning #419

Announcements:
 * Make the zip command configurable #418


## 1.44.2
Released 2017-04-05

Bug fixes:
 * Update queue index while enqueueing jobs to the top of queue.


## 1.44.1
Released 2017-04-04

Bug fixes:
 * Avoid to scan the whole meta-database to discover active job queues. Now Batch Queries uses a set as index to know what queues are being processed #415


## 1.44.0
Released 2017-03-30

Announcements:
 * Active GC interval for Node.js >=v6.


## 1.43.1
Released 2017-01-16

Announcements:
 * Upgrade cartodb-psql to 0.7.1.


## 1.43.0
Released 2017-01-16

Announcements:
 * Upgrade cartodb-psql to 0.7.0.


## 1.42.7
Released 2017-01-12

Enhancements:
 * Avoid gpkg fid column #404.


## 1.42.6
Released 2016-12-19

Announcements:
 * Upgrade cartodb-redis to 0.13.2.
 * Upgrade redis-mpool to 0.4.1.


## 1.42.5
Released 2016-12-12

Enhancements:
 * Improvements in testing environment/tests.


## 1.42.4
Released 2016-11-30

Enhancements:
 * Include query status in batch queries log entries.


## 1.42.3
Released 2016-11-07

Announcements:
 * Raise payload limit for batch-queries to 16kb.


## 1.42.2
Released 2016-11-07

Bug fixes:
 * Improve error handling while registering jobs to be tracked.


## 1.42.1
Released 2016-11-03

Bug fixes:
 * Avoid to use SCAN command to find work-in-progress queues.


## 1.42.0
Released 2016-11-02

Announcements:
 * Adds endpoint to check running batch queries


## 1.41.0
Released 2016-10-21

Announcements:
 * Stop migrating old queues by default.

Bug fixes:
 * Fix some scenarios where batch queries got stuck waiting for available slots.


## 1.40.0
Released 2016-10-20

New features:
 * Batch queries are handled per db host.
   - There is an scheduler controlling how many queries and in what order they are run.
     - Priority is based on: number of queries already ran, and oldest user in queue.
 * Batch queries capacity: allow to configure how many jobs to run per db host.


## 1.39.1
Released 2016-10-17

Enhancements:
 * Log creation and waiting time for fallback jobs' queries.


## 1.39.0
Released 2016-10-17

Enhancements:
 * Use just one Redis pool across the whole application.

New features:
 * Batch queries use per user-queues.
 * Batch queries queues can limit the number of queued jobs per user.
   - Default is 64 jobs.
   - Configuration key `batch_max_queued_jobs` allows to modify the limit.


## 1.38.2
Released 2016-10-13

Bug fixes:
 * Batch queries: release redis clients to pool from locker and seeker.


## 1.38.1
Released 2016-10-13

Enhancements:
 * Batch queries: improvements over leader locking.


## 1.38.0
Released 2016-10-11

Announcements:
 * Allow to set statement timeout per query in multi query batch queries.
 * Batch queries default statement timeout set to 12 hours.
 * Multiple queries jobs pushed as first job between queries.


## 1.37.1
Released 2016-10-05

Bug fixes:
 * Body parser accepting multipart requests.


## 1.37.0
Released 2016-10-04

Enhancements:
 * Migrate to Express.js 4.x series.


## 1.36.2
Released 2016-10-03

Bug fixes:
 - Batch Queries logs: use path instead of stream to be able to reopen FD.

## 1.36.1
Released 2016-09-30

Enhancements:
 * Tag fallback jobs logs.


## 1.36.0
Released 2016-09-30

New features:
 * Log queries from batch fallback jobs.

Enhancements:
 * assert.response following callback(err, obj) pattern.


## 1.35.0
Released 2016-09-15

New features:
 * Allow to use `--config /path/to/config.js` to specify configuration file.
   - Environment will be loaded from config file if `environment` key is present, otherwise it keeps current behaviour.

Bug fixes:
 * Allow to use absolute paths for log files.

Announcements:
 * Removes support for optional rollbar logging.


## 1.34.2
Released 2016-08-30

Announcements:
 * Upgrades cartodb-redis to 0.13.1.
 * Set TTL of finished job to 2h


## 1.34.1
Released 2016-07-11

Bug fixes:
 * Fixed issue with redis connections in Batch API #326


## 1.34.0
Released 2016-07-11

New features:
 * Skip tables with no updated_at registered in cdb_tablemetadata.
 * Allow to setup more than one domain to validate oauth against.


## 1.33.0
Released 2016-07-01

New features:
 * Add `<%= job_id %>` template support for onerror and onsuccess fallback queries.


## 1.32.0
Released 2016-06-30

New features:
 * Broadcast after enqueueing jobs to improve query distribution load.
 * Batch pub-sub channel handles its connections using `redis-mpool`.


## 1.31.0
Released 2016-06-29

New features:
 * Adds start and end time for batch queries with fallback.
 * Add `<%= error_message %>` template support for onerror fallback queries.


## 1.30.1
Released 2016-06-23

Bug fixes:
 * Fixed issue with profiling in Batch API #318


## 1.30.0
Released 2016-06-14

Announcements:
 * Now Batch API sends stats metrics to statsd server #312
 * Now Batch API sets "skipped" instead of "pending" to queries that won't be performed #311

 Bug fixes:
  * Fixed issue with error handling in Batch API #316


## 1.29.2
Released 2016-05-25

Bug fixes:
 * Fixed issue with status transition in fallback jobs #308


## 1.29.1
Released 2016-05-24

Announcements:
 * Change Batch API size limit: 8kb per job.


## 1.29.0
Released 2016-05-24

New features:
 * Add support for fallback-jobs in Batch API #296

Bug fixes:
 * Fix issue in Batch API when a 'no longer running' job reports as 'running' before and after a job cancel #293


## 1.28.1
Released 2016-05-12

Bug fixes:
 * OGR with _needSRS=true_ fails for empty tables #299


## 1.28.0
Released 2016-05-11

Announcements:
 - Upgrades step-profiler to 0.3.0 to avoid dots in json keys #294

 New features:
  * Add support for geopackage format (`format=gpkg` at the URL) #291


## 1.27.1
Released 2016-04-18

Bug fixes:
  * Size of queries in Batch API is limited to 4kb per job


## 1.27.0
Released 2016-04-05

New features:
 * Add support for multiquery-jobs in Batch API #280
 * Add queue discovering for Batch processing at service startup #282

Bug fixes:
 * Fix issue in Batch API when after a period of inactivity it does not process jobs


## 1.26.0
Released 2016-03-08

New features:
 * Add [Surrogate-Key](https://github.com/CartoDB/cartodb/wiki/CartoDB-Surrogate-Keys) headers to responses

Enhancements:
 * Use new `node-cartodb-query-tables` library to obtain affected tables in queries


## 1.25.3
Released 2016-02-02

Enhancements:
 * QueryTablesApi caches affected tables and retrieves last modification #269


## 1.25.2
Released 2016-02-01

Bug fixes:
 * Skip query-tables-api for authenticated requests


## 1.25.1
Released 2016-01-28

Bug fixes:
 * Fix X-Cache-Channel generation when request are not authenticated #266


## 1.25.0
Released 2016-01-26

Bug fixes:
 * Stop adding X-Cache-Channel header when no tables involved #250

New features:
 * Set `Last-Modified` header based on affected tables (#101)
 * Batch API (#261):
   - New endpoint to create, read, update and delete long-running queries (jobs).
   - Batch service to process jobs.
 * Set Last-Modified header based on affected tables #247

Announcements:
 * Upgrades cartodb-psql to [0.6.1](https://github.com/CartoDB/node-cartodb-psql/releases/tag/0.6.1)


## 1.24.0
Released 2015-08-04

New features:
 * Client is removed from pool after error happens. This help to avoid issues with transactions (#241).

Announcements:
 * Upgrades cartodb-psql to [0.6.0](https://github.com/CartoDB/node-cartodb-psql/releases/tag/0.6.0)


## 1.23.0
Released 2015-06-16

Announcements:
 * Reverts tables=<fake> for ogr2ogr commands
   Ref https://github.com/CartoDB/CartoDB-SQL-API/commit/b6e53f732672369d7f9be26555ef412edc202727

Enhancements:
 * Makes ogr2ogr command configurable so it's possible to change path/bin
 * Uses :remote-addr instead of :req[X-Real-IP] \(#197)

New features:
 * Adds SpatiaLite as export format (#226)


## 1.22.2
Released 2015-05-26

Bug fixes:
 * Reintroduces tables= param in ogr2ogr exports (#204)
   This will avoid running a heavy ogr2ogr query when the pg catalog is big
   Ref https://github.com/CartoDB/CartoDB-SQL-API/commit/84c422c505391ef0e743aed2204214d4286d7e30


## 1.22.1
Released 2015-05-14

Bug fixes:
 * Close stream responses on error (#219)

Enhancements:
 * Format files split into pg and ogr directories


## 1.22.0
Released 2015-04-09

Announcements:
 * Now health check only validates against a disabling file
 * Supports user extraction from request params via base_url config


## 1.21.1
Released 2015-03-02

Enhancements:
 * Improve row size limit error message


## 1.21.0
Released 2015-03-02

New features:
 * Logs with console.error too large row errors


## 1.20.0
Released 2015-02-26

Announcements:
 * Upgrades cartodb-psql to 0.5.1 for keep alive configuration
 * Dependencies from npm registry when available


## 1.19.1
Released 2014-12-15

Bug fixes:
 * Closes stream responses on error (#188)
 * Closes fd for log files on `kill -HUP` (#187)


## 1.19.0
Released 2014-11-21

New features:
 * Add more fields to error responses with hint, detail and context for SQL errors.

Enhancements:
 * Don't loop twice over svg rows
 * Improve statement timeout error messages
 * Improve topojson output by streaming json


## 1.18.0
Released 2014-10-14

Announcements:
 * Dropping support for npm <1.2.1
   npm-shrinkwrap.json is incompatible when generated with npm >=1.2.1 and consumed by npm <1.2.1


## 1.17.1
Released 2014-09-23

Enhancements:
 * Removes tables=fake wadus param in ogr2ogr command so it can go to geometry
   columns view to retrieve the column data type. This requires to grant select
   permission on geometry_columns and geography_columns to the public user.
 * Removes query tables console.log

Bug fixes:
 * Fixes "make check" on systems with non-default PostgreSQL superuser (#152)


## 1.17.0
Released 2014-09-17

Bug fixes:
 * Returns 401 Unauthorized for queries without permission

New features:
 * New header for database host serving the request
 * Health check endpoint

Enhancements:
 * Upgrades dependencies:
    * cartodb-redis
    * cartodb-psql
    * log4js


## 1.16.0
Released 2014-08-19

Enhancements:
 * Metrics revamp: removes and adds some metrics

## 1.15.0
Released 2014-08-18

Enhancements:
 * Upgrades cartodb-redis
 * Upgrades underscore, removes underscore.string dependency
 * Uses https endpoints for dependencies


## 1.14.1
Released 2014-08-08

Other changes:
 * Constraint for pg_ queries if request is non authenticated

## 1.14.0
Released 2014-08-07

Other changes:
 * Removes sql statements restriction on pg_ queries


## 1.13.0
Released 2014-08-07

New features:
 * New authentication mechanism: checks in advance if credentials are provided
   in order to do a single request to redis to retrieve the required database
   connection parameters.
 * Retrieves OAuth hash values using new cartodb-redis method so it will reuse
   the redis pool from cartodb-redis instead of using just one pool for oauth.


## 1.12.1
Released 2014-08-05

Bug fixes:
 * Fixes GeoJSON stream error responses
 * Fixes GeoJSON stream empty responses
 * JSONP callbacks return with 200 status error code

Enhancements:
 * Re-enables tests

## 1.12.0
Released 2014-08-04

New features:
 * Add header for host serving the request
 * Stream JSON/GeoJSON responses

## 1.11.0
Released 2014-07-30

New features:
 * Support for different schemas and different public users

Enhancements:
 * Profiler header sent as JSON string

Other changes:
 * Revamped documentation

Bug fixes:
 * Pick redis pool configuration values

## 1.10.1
Released 2014-06-05

Bug fixes:
 * Backing out Stream JSON responses

## 1.10.0
Released 2014-06-04

New features:
 * Order by and sort order through http query params
 * Cancelling queries in Postgresql when HTTP request is aborted/closed

Enhancements:
 * Stream JSON responses
 * Pre-compiling may write regex
 * Set default PostgreSQL application name to "cartodb_sqlapi"

Bug fixes:
 * Support trailing semicolons (#147)

## 1.9.1
Released 2014-03-27

Bug fixes:
 * Fix paging with queries starting with comments (#144)

## 1.9.0
Released 2014-03-20

New features:
 * Add optional support for rollbar (#137)
 * Add '/version' endpoint (#138)
 * Add profiler support (#142)
 * Add statsd support (#133)

Enhancements:
 * Allow configuring log_format (#131)
 * Use log4js for logging (#136)
 * Include version in startup log
 * Allow passing environment configuration name via NODE_ENV to app.js
 * Print environment configuration name on app start
 * Upgrade node-zipfile to ~0.5.0
 * Add support for node-0.10 (#132)
 * Fix lack of response on backend crash (#135)
 * Reduce work on aborted requests (#129)

Other changes:
 * Switch to 3-clause BSD license (#143)

## 1.8.3
Released 2014-02-10

Bug fixes:
 * Honour the 'node_socket_timeout' configuration directive (#128)

Enhancements:
 * Add support for error handling in assert.request
 * Stop using ANSI colors in the logs (#130)

## 1.8.2
Released 2014-01-20

Bug fixes:
 * Restore compatibility with 1.6.x configuration
 * Use db_port in ogr2ogr

## 1.8.1
Released 2014-01-10

Bug fixes:
 * Fix use of "SELECT .. INTO" with windowing params (#127)


## 1.8.0
Released 2013-12-18

New features:
* Add 'user_from_host' directive to generalize username extraction (#124)

Improvements:
* Enhance error message on unknown cartodb username (#126)

## 1.7.1
Released 2013-12-02

* Fix documentation for CSV export format: geoms are in hexewkb, not ewkt.
* Fix field types names lookup after PSQL model refactoring
  NOTE: fixes missing .prj in shapefile export regression (#122)

## 1.7.0
Released 2013-11-19

New features:
* Optionally read user-specific database_host and database_password
  from redis, as per CartoDB-2.5.0 model (#120, #121)
* Add warnings and notices to JSON response (#104)

Other changes:
* CartoDB redis interaction delegated to "cartodb-redis" module

## 1.6.3
Released 2013-11-10

* JSON format: correctly recognize "numeric" type columns (#119)

## 1.6.2
Released 2013-11-07

* JSON format: correctly recognize "date" type columns (#117)
* Allow access to tables whose name contains (but does not start with)
  the "pg_" substring (#118)

## 1.6.1
Released 2013-11-05

* Still set a meaningful X-Cache-Channel with cache_policy=persist (#105)
* Fix wrong projection in KML exports for manually altered tables (#116)
* Set KML folder name to the requested filename (#115)
* Make public PostgreSQL user name a configuration parameter (#56)

## 1.6.0
Released 2013-10-02

* Fix shapefile export for non-linestring results starting with NULLs (#111)
* Fix missing .prj in shapefile export (#110)
* Improve recognition of non-standard field types names by db lookup (#112)
* Upgrade node-pg dependency to 2.6.2
* Drop support for cluster

## 1.5.4
Released 2013-10-01

* Honour skipfields in JSON schema response (#109)

## 1.5.3
Released yyyy-mm-dd

* Set Last-Modified header with cache_policy=persist
* Raise max-age to one year for all cacheable queries
* Set max-age to 0 for uncacheable (mutating) queries
* Add REINDEX to the list of uncacheable queries
* Support all parameters with POST as well as GET
* Ensure testsuite passes with both GDAL-0.9 and GDAL-0.10
* JSON output: report boolean types as boolean, not string (#106)

## 1.5.2
Released yyyy-mm-dd

* Keep numbers as such in JSON output (#100)
* Revert max-age=0 in Cache-Control when using no-cache

## 1.5.1
Released yyyy-mm-dd

* Improve cacheability of queries selecting "updated_at" fields (#99)

## 1.5.0
Released yyyy-mm-dd

* Add "fields" member in JSON return (#97)
* Add --skipfields switch to cdbsql
* Fix windowing with CTE
* Retain UTC offset in JSON date output
* Set max-age=0 in Cache-Control when using no-cache

## 1.4.1
Released yyyy-mm-dd

* Fix windowing support for non-uppercased SELECT queries
* Fix oAuth testcase

## 1.4.0
Released yyyy-mm-dd

* Add arraybuffer format
* Fix filesystem access conflict among clustered processes
* Fix discard of queued export requests on error
* Really fix problem identifying OAuth requests

## 1.3.10
Released yyyy-mm-dd

* Fixed problem identifying OAuth request protocol
* Make base url configurable
* Update underscore dependency
* Add munin plugin
* Make PostgreSQL client pooling settings configurable (#47)
* Do not execute queries on OPTIONS (#94)
* Survive postgresql connection losses (#95)

## 1.3.9
Released yyyy-mm-dd

* Do not choke on multiple `skipfields` parameter
* Do not request caching of TRUNCATE queries

## 1.3.8
Released yyyy-mm-dd

* Make using SET or querying system catalogues harder
* Allow sql queries to end with a semicolon (#90)
* Testsuite fixes, jenkins ready :)

## 1.3.7
Released yyyy-mm-dd

* Fix parsing of numeric arrays (#88)
* node-pool upgraded to 2.0.3
* Reduce memory use on KML export
* Fix concurrent request for KML and Shapefile exports
* Send an empty-like KML when exporting zero-rows queries
* Make temporary dir a configuration setting
* Use OGR for CSV output, reducing memory requirement

## 1.3.6
Released yyyy-mm-dd

* Do not confuse warnings with errors on shapefile output (#87)

## 1.3.5
Released 2013-02-19

* Fix skipfields use with SHP output format (#81)
* Fix Content-Disposition for error responses (#82)
* Add pid to /cachestatus (#83)
* Check CDB_QueryTable response before saving into cache (#83)
* Use an expiring LRU cache for query tables (#83)
* Fix X-Cache-Channel computation with paging parameters (#85)

## 1.3.4
Released 2013-01-21

* Improve mixed-geometry export error message (#78)
* Remove NULL the_geom features from topojson output (#80)
* Fix crash when issuing SQL "COPY" command
* Return an error when "the_geom" is in skipfield for SVG output (#73)

## 1.3.3
Released 2013-01-11

* Fix Date format in CSV output (#77)
* Add TopoJSON output format (#79)

## 1.3.2
Released 2012-11-30

* Fix KML export truncation (#70)
* Fix UTF8 in shapefile export (#66)

## 1.3.1
Released yyyy-mm-dd

* Support 'format' and 'filename' params in POST
* Fix oAuth bug introduced by 'skipfields' param in 1.3.0 (#69)

## 1.3.0
Released yyyy-mm-dd

* Support for specifying a filename for exports (#64)
* Support for specifying a list of fields to skip from output (#63)
* Add 'cache_policy' parameter (#62)

## 1.2.1
Released yyyy-mm-dd

* Added timeout default to 600 miliseconds in cluster.js

## 1.2.0
Released yyyy-mm-dd

* New output formats:
  * ESRI Shapefile (format=shp)
  * SVG (format=svg)
  * KML (format=kml)
* Advertise header presence in CSV Content-Type
* Fix CSV output with no rows (#60)
* Use "attachment" Content-Disposition for all output formats (#61)
* Only use last format parameter when multiple are requested
* Return a 400 response on unsupported format request
* Added X-Prototype-Version, X-CSRF-Token to Access-Control-Allow-Headers

## 1.1.0
Released 2012-10-30

* Fixed problem in cluster2 with pidfile name
* SVG output format
* Enhancement to the cdbsql tool:
  - New switches: --format, --key, --dp
  - Interactive mode
* API documentation
* ./configure script
* Restrict listening to a node host

## 1.0.0
Released 2012-10-03

* Migrated to node 0.8 version

## 0.9.0
Released 2012-09-18

* Fix INSERT and UPDATE with RETURNING clause
