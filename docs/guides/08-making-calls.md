## Making Calls to the SQL API

CARTO is based on the rock solid PostgreSQL database. All of your tables reside in a single database, which means you can perform complex queries joining tables, or carrying out geospatial operations. The best place to learn about PostgreSQL's SQL language is the [official documentation](http://www.postgresql.org/docs/9.1/static/).

CARTO is also based on PostGIS, so you can view the [official PostGIS reference](https://postgis.net/documentation/) to know what functionality we support in terms of geospatial operations. All of our tables include a column called *the_geom,* which is a geometry field that indexes geometries in the EPSG:4326 (WGS 1984) coordinate system. All tables also have an automatically generated and updated column called *the_geom_webmercator*. We use the column internally to quickly create tiles for maps.


### URL Endpoints

All SQL API requests to your CARTO account should follow this general pattern:

##### SQL Query Example

```bash
https://{username}.carto.com/api/v2/sql?q={SQL statement}
```

If you encounter errors, double-check that you are using the correct account name, and that your SQL statement is valid. A simple example of this pattern is conducting a count of all the records in your table:

##### Count Example

```bash
https://{username}.carto.com/api/v2/sql?q=SELECT count(*) FROM {table_name}
```

##### Result

```javascript
{
  time: 0.007,
  total_rows: 1,
  rows: [
    {
      count: 4994
    }
  ]
}
```

**Tip:** Finally, remember that in order to use the SQL API, either your table must be public, or you must be [authenticated]({{site.sqlapi_docs}}/guides/authentication/#authentication) using API Keys.

So, using the same Count Example, it would be as follows:

```bash
https://{username}.carto.com/api/v2/sql?api_key={your_api_key}&q=SELECT count(*) FROM {table_name}
```


### POST and GET

The CARTO SQL API is setup to handle both GET and POST requests. You can test the GET method directly in your browser. Below is an example of a jQuery SQL API request to CARTO:

#### jQuery

##### Call

```javascript
$.getJSON('https://{username}.carto.com/api/v2/sql/?q='+sql_statement, function(data) {
  $.each(data.rows, function(key, val) {
    // do something!
  });
});
```

By default, GET requests work from anywhere. In CARTO, POST requests work from any website as well. We achieve this by hosting a cross-domain policy file at the root of all of our servers. This allows you the greatest level of flexibility when developing your application.


### Response Formats

The SQL API accepts many output formats that can be useful to export data, such as: 

- GPKG
- CSV
- SHP
- SVG
- KML
- SpatiaLite
- GeoJSON

The most common response format used is JSON. For example, if you are building a web-application, the lightweight JSON format allows you to quickly integrate data from the SQL API. This section focuses on the call and response functions for generating the JSON output format.

#### JSON

##### Call

```bash
https://{username}.carto.com/api/v2/sql?q=SELECT * FROM {table_name} LIMIT 1
```

##### Result

```javascript
{
  time: 0.006,
  total_rows: 1,
  rows: [
    {
      year: "  2011",
      month: 10,
      day: "11",
      the_geom: "0101000020E610...",
      cartodb_id: 1,
      the_geom_webmercator: "0101000020110F000..."
    }
  ]
}
```

Alternatively, you can use the [GeoJSON specification](http://www.geojson.org/geojson-spec.html) to return data from the API. To do so, simply supply the `format` parameter as GeoJSON:

#### GeoJSON

##### Call

```bash
https://{username}.carto.com/api/v2/sql?format=GeoJSON&q=SELECT * FROM {table_name} LIMIT 1
```

##### Result

```javascript
{
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        year: "  2011",
        month: 10,
        day: "11",
        cartodb_id: 1
      },
      geometry: {
        type: "Point",
        coordinates: [
          -97.335,
          35.498
        ]
      }
    }
  ]
}
```

### Output Filename

To customize the output filename, add the `filename` parameter to your URL:

##### Call

```bash
https://{username}.carto.com/api/v2/sql?filename={custom_filename}&q=SELECT * FROM {table_name} LIMIT 1
```


### Getting Table Information

Currently, there is no public method to access your table schemas. The simplest way to retrieve table structure is to access the first row of the data,

##### Call

```bash
https://{username}.carto.com/api/v2/sql?q=SELECT * FROM {table_name} LIMIT 1
```


### Response Errors

To help you debug your SQL queries, the CARTO SQL API returns the full error provided by PostgreSQL, as part of the JSON response. Error responses appear in the following format,

##### Result

```javascript
{
  error: [
    "syntax error at or near "LIMIT""
  ]
}
```

**WARNING**: If the database finds an error after it has started streaming the response, the error header will still be set but the HTTP status code will be **200**.

You can use these errors to help understand your SQL. If you encounter errors executing SQL, either through CARTO Builder, or through the SQL API, it is suggested to Google search the error for independent troubleshooting.

### Write Data to your CARTO Account

When writing data to your CARTO account, you are executing SQL queries to manage data in a table. Performing inserts or updates on your data is achieved by using your [API Key]({{ site.sqlapi_docs }}/guides/authentication/). Simply supply a well-formatted SQL [INSERT](http://www.postgresql.org/docs/9.1/static/sql-insert.html) or [UPDATE](http://www.postgresql.org/docs/9.1/static/sql-update.html) statement for your table, along with the api_key parameter for your account.

**Tip:** All requests should be private, as anyone with your API Key will be able to modify your tables. 

A well-formatted SQL insert statement means that all of the columns that you want to insert to your data already exist in your table, and all the values for those columns are the correct type (quoted string, unquoted string for geoms and dates, or numbers).

#### Insert

##### Call

```bash
https://{username}.carto.com/api/v2/sql?q=INSERT INTO test_table (column_name, column_name_2, the_geom) VALUES ('this is a string', 11, ST_SetSRID(ST_Point(-110, 43),4326))&api_key={api_key}
```

Updates are just as simple. The following example displays how to update a row based on the value of the `cartodb_id` column.

#### Update

##### Call

```bash
https://{username}.carto.com/api/v2/sql?q=UPDATE test_table SET column_name = 'my new string value' WHERE cartodb_id = 1 &api_key={api_key}
```
