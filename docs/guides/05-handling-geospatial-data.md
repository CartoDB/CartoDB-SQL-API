## Handling Geospatial Data

Handling geospatial data through the SQL API is easy. By default, *the_geom* is returned straight from the database, in a format called Well-Known Binary. There are a handful of ways you can transform your geometries into more useful formats.

The first is to use the format=GeoJSON method described above. Others can be handled through your SQL statements directly. For example, enclosing your the_geom in a function called [ST_AsGeoJSON](http://www.postgis.org/documentation/manual-svn/ST_AsGeoJSON.html) will allow you to use JSON for your data but a GeoJSON string for your geometry column only. Alternatively, using a the [ST_AsText](http://www.postgis.org/documentation/manual-svn/ST_AsGeoJSON.html) function will return your geometry as Well-Known Text.

#### ST_AsGeoJSON

##### Call

```bash
https://{username}.carto.com/api/v2/sql?q=SELECT cartodb_id,ST_AsGeoJSON(the_geom) as the_geom FROM {table_name} LIMIT 1
```

##### Result

```javascript
{
  time: 0.003,
  total_rows: 1,
  rows: [
    {
      cartodb_id: 1,
      the_geom: "{"type":"Point","coordinates":[-97.3349,35.4979]}"
    }
  ]
}
```

#### ST_AsText

##### Call

```bash
https://{username}.carto.com/api/v2/sql?q=SELECT cartodb_id,ST_AsText(the_geom) FROM {table_name} LIMIT 1
```

##### Result

```javascript
{
  time: 0.003,
  total_rows: 1,
  rows: [
    {
      cartodb_id: 1,
      the_geom: "POINT(-74.0004162 40.6920918)",
    }
  ]
}
```

More advanced methods exist in the PostGIS library to extract meaningful data from your geometry. Explore the PostGIS documentation and get familiar with functions such as, [ST_XMin](http://www.postgis.org/docs/ST_XMin.html), [ST_XMax](http://www.postgis.org/docs/ST_XMax.html), [ST_AsText](http://www.postgis.org/docs/ST_AsText.html), and so on.

All data returned from *the_geom* column is in WGS 84 (EPSG:4326). You can change this quickly on the fly, by using SQL. For example, if you prefer geometries using the Hanoi 1972 (EPSG:4147) projection, use [ST_Transform](http://www.postgis.org/docs/ST_Transform.html),

#### ST_Transform

```bash
https://{username}.carto.com/api/v2/sql?q=SELECT ST_Transform(the_geom,4147) FROM {table_name} LIMIT 1
```

CARTO also stores a second geometry column, *the_geom_webmercator*. We use this internally to build your map tiles as fast as we can. In the user-interface it is hidden, but it is visible and available for use. In this column, we store a reprojected version of all your geometries using Web Mercator (EPSG:3857).
