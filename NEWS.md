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
