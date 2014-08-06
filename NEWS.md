1.13.0 - 2014-mm-dd
-------------------

New features:

 * New authentication mechanism: checks in advance if credentials are provided
   in order to do a single request to redis to retrieve the required database
   connection parameters.
 * Retrieves OAuth hash values using new cartodb-redis method so it will reuse
   the redis pool from cartodb-redis instead of using just one pool for oauth.


1.12.1 - 2014-08-05
-------------------

Bug fixes:

 * Fixes GeoJSON stream error responses
 * Fixes GeoJSON stream empty responses
 * JSONP callbacks return with 200 status error code

Enhancements:

 * Re-enables tests

1.12.0 - 2014-08-04
-------------------

New features:

 * Add header for host serving the request
 * Stream JSON/GeoJSON responses

1.11.0 - 2014-07-30
-------------------

New features:

 * Support for different schemas and different public users

Enhancements:

 * Profiler header sent as JSON string

Other changes:

 * Revamped documentation

Bug fixes:

 * Pick redis pool configuration values

1.10.1 - 2014-06-05
-------------------
Bug fixes:

 * Backing out Stream JSON responses

1.10.0 - 2014-06-04
-------------------

New features:

 * Order by and sort order through http query params
 * Cancelling queries in Postgresql when HTTP request is aborted/closed

Enhancements:

 * Stream JSON responses
 * Pre-compiling may write regex
 * Set default PostgreSQL application name to "cartodb_sqlapi"

Bug fixes:

 * Support trailing semicolons (#147)

1.9.1 - 2014-03-27
------------------

Bug fixes:

 * Fix paging with queries starting with comments (#144)

1.9.0 - 2014-03-20
------------------

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

1.8.3 - 2014-02-10
------------------

Bug fixes:

 * Honour the 'node_socket_timeout' configuration directive (#128)

Enhancements:

 * Add support for error handling in assert.request
 * Stop using ANSI colors in the logs (#130)

1.8.2 - 2014-01-20
------------------

Bug fixes:

 * Restore compatibility with 1.6.x configuration
 * Use db_port in ogr2ogr

1.8.1 - 2014-01-10
------------------

Bug fixes:

 * Fix use of "SELECT .. INTO" with windowing params (#127)


1.8.0 - 2013-12-18
------------------

New features:

* Add 'user_from_host' directive to generalize username extraction (#124)

Improvements:

* Enhance error message on unknown cartodb username (#126)

1.7.1 - 2013-12-02
------------------

* Fix documentation for CSV export format: geoms are in hexewkb, not ewkt.
* Fix field types names lookup after PSQL model refactoring
  NOTE: fixes missing .prj in shapefile export regression (#122)

1.7.0 - 2013-11-19
------------------

New features:

* Optionally read user-specific database_host and database_password
  from redis, as per CartoDB-2.5.0 model (#120, #121)
* Add warnings and notices to JSON response (#104)

Other changes:

* CartoDB redis interaction delegated to "cartodb-redis" module

1.6.3 - 2013-11-10
------------------
* JSON format: correctly recognize "numeric" type columns (#119)

1.6.2 - 2013-11-07
------------------
* JSON format: correctly recognize "date" type columns (#117)
* Allow access to tables whose name contains (but does not start with)
  the "pg_" substring (#118)

1.6.1 - 2013-11-05
------------------
* Still set a meaningful X-Cache-Channel with cache_policy=persist (#105)
* Fix wrong projection in KML exports for manually altered tables (#116)
* Set KML folder name to the requested filename (#115)
* Make public PostgreSQL user name a configuration parameter (#56)

1.6.0 - 2013-10-02
------------------
* Fix shapefile export for non-linestring results starting with NULLs (#111)
* Fix missing .prj in shapefile export (#110)
* Improve recognition of non-standard field types names by db lookup (#112)
* Upgrade node-pg dependency to 2.6.2
* Drop support for cluster

1.5.4 - 2013-10-01
------------------
* Honour skipfields in JSON schema response (#109)

1.5.3
-----
* Set Last-Modified header with cache_policy=persist
* Raise max-age to one year for all cacheable queries
* Set max-age to 0 for uncacheable (mutating) queries 
* Add REINDEX to the list of uncacheable queries
* Support all parameters with POST as well as GET
* Ensure testsuite passes with both GDAL-0.9 and GDAL-0.10
* JSON output: report boolean types as boolean, not string (#106)

1.5.2
-----
* Keep numbers as such in JSON output (#100)
* Revert max-age=0 in Cache-Control when using no-cache

1.5.1
-----
* Improve cacheability of queries selecting "updated_at" fields (#99)

1.5.0
-----
* Add "fields" member in JSON return (#97)
* Add --skipfields switch to cdbsql
* Fix windowing with CTE
* Retain UTC offset in JSON date output
* Set max-age=0 in Cache-Control when using no-cache

1.4.1
-----
* Fix windowing support for non-uppercased SELECT queries
* Fix oAuth testcase

1.4.0
-----
* Add arraybuffer format
* Fix filesystem access conflict among clustered processes
* Fix discard of queued export requests on error
* Really fix problem identifying OAuth requests

1.3.10
------
* Fixed problem identifying OAuth request protocol
* Make base url configurable
* Update underscore dependency 
* Add munin plugin
* Make PostgreSQL client pooling settings configurable (#47)
* Do not execute queries on OPTIONS (#94)
* Survive postgresql connection losses (#95)

1.3.9
-----
* Do not choke on multiple `skipfields` parameter
* Do not request caching of TRUNCATE queries

1.3.8
-----
* Make using SET or querying system catalogues harder
* Allow sql queries to end with a semicolon (#90)
* Testsuite fixes, jenkins ready :)

1.3.7
-----
* Fix parsing of numeric arrays (#88)
* node-pool upgraded to 2.0.3
* Reduce memory use on KML export
* Fix concurrent request for KML and Shapefile exports
* Send an empty-like KML when exporting zero-rows queries
* Make temporary dir a configuration setting
* Use OGR for CSV output, reducing memory requirement

1.3.6 (DD/MM/YY)
-----
* Do not confuse warnings with errors on shapefile output (#87)

1.3.5 (19/02/13)
-----
* Fix skipfields use with SHP output format (#81)
* Fix Content-Disposition for error responses (#82)
* Add pid to /cachestatus (#83)
* Check CDB_QueryTable response before saving into cache (#83)
* Use an expiring LRU cache for query tables (#83)
* Fix X-Cache-Channel computation with paging parameters (#85)

1.3.4 (21/01/13)
-----
* Improve mixed-geometry export error message (#78)
* Remove NULL the_geom features from topojson output (#80)
* Fix crash when issuing SQL "COPY" command
* Return an error when "the_geom" is in skipfield for SVG output (#73)

1.3.3 (11/01/13)
-----
* Fix Date format in CSV output (#77)
* Add TopoJSON output format (#79)

1.3.2 (30/11/12)
-----
* Fix KML export truncation (#70)
* Fix UTF8 in shapefile export (#66)

1.3.1 (DD/MM/YY)
-----
* Support 'format' and 'filename' params in POST
* Fix oAuth bug introduced by 'skipfields' param in 1.3.0 (#69)

1.3.0 (DD/MM/YY)
-----
* Support for specifying a filename for exports (#64)
* Support for specifying a list of fields to skip from output (#63)
* Add 'cache_policy' parameter (#62)

1.2.1 (DD/MM/YY)
-----
* Added timeout default to 600 miliseconds in cluster.js

1.2.0 (DD/MM/YY)
-----
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

1.1.0 (30/10/12)
-----
* Fixed problem in cluster2 with pidfile name
* SVG output format
* Enhancement to the cdbsql tool:
  - New switches: --format, --key, --dp
  - Interactive mode
* API documentation
* ./configure script
* Restrict listening to a node host

1.0.0 (03/10/12)
-----
* Migrated to node 0.8 version

0.9.0 (18/09/12)
-----
* Fix INSERT and UPDATE with RETURNING clause
