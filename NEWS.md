1.1.1 (DD/MM/YY)
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
