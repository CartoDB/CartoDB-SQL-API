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
