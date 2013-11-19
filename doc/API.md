SQL API
=======

Request format
--------------

Supported query string parameters:

  'q':        Specifies the SQL query to run
              Example:
              'http://entrypoint?q=SELECT count(*) FROM mytable'

  'format':   Specifies which format to use for the response.
              Supported formats: JSON (the default), GeoJSON,
              TopoJSON, CSV, SVG, SHP, arraybuffer

  'filename': Sets the filename to use for the query result 
              file attachment

  'skipfields':
              Comma separate list of fields that are not wanted
              in output. Only useful with "SELECT *" queries.

  'dp':       Number of digits after the decimal point.
              Only affects format GeoJSON, TopoJSON, SVG.
              By default this is 6.

  'api_key':  Needed to authenticate in order to modify the database.

  'cache_policy':
              Set to "persist" to have the server send an Cache-Control
              header requesting caching devices to keep the response
              cached as much as possible. This is best used with a
              timestamp value in cache_buster for manual control of
              updates.

Response formats
----------------


### JSON

The standard response from the CartoDB SQL API is JSON. If you are
building a web-application, the lightweight JSON format allows you to
quickly integrate data from the SQL API.

The JSON response is as follows:
```
    {
        time: 0.006,
        total_rows: 1,
        fields: {
                'year': { type:'string' },
                'the_geom': { type:'geometry' },
                'cartodb_id': { type:'number' },
                'created_at': { type:'date' },
                'updated_at': { type:'date' }
                'valid': { type:'boolean' }
        },
        rows: [
            {
                year: "  2011",
                the_geom: "0101000020E610...",
                cartodb_id: 1,
                created_at: "2012-02-06T22:50:35.778Z",
                updated_at: "2012-02-12T21:34:08.193Z",
                valid: true
            }
        ],
        notices: [ 'notice1', 'notice2' ], // optional
        warnings: [ 'warning1', 'warning2' ] // optional
    }
```

Note that values of numerical fields will be rounded to at most 16 significant
digits due to a limit in the JSON format itself. If more precision is needed
the caller can cast those fields to text using SQL constructs.

### GeoJSON

Alternatively, you can use the GeoJSON specification for returning data
from the API. To do so, simply supply the format parameter as GeoJSON.

The GeoJSON response is follows:
```
    {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {
                    year: "  2011",
                    month: 10,
                    day: "11",
                    cartodb_id: 1,
                    created_at: "2012-02-06T22:50:35.778Z",
                    updated_at: "2012-02-12T21:34:08.193Z"
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

### CSV

CSV export format has field names in first line (header),
uses CR/NL line endings and EWKT format for geometri fields.

See https://github.com/postgis/postgis/blob/svn-trunk/doc/ZMSgeoms.txt#L173

### KML

See http://en.wikipedia.org/wiki/KML

### SVG

See http://en.wikipedia.org/wiki/SVG

### TopoJSON

See http://en.wikipedia.org/wiki/Topojson

### SHP

Shapefile output composed by .shp, .shx, .dbf and .prj files
compressed in a .zip.

See http://en.wikipedia.org/wiki/Shapefile

### Arraybuffer

An octet stream binary-encoding each field as a typed array of value.
TODO: write more about this format
See http://github.com/CartoDB/CartoDB-SQL-API/issues/96

Response errors
---------------

To help you debug your SQL queries, the CartoDB SQL API returns errors
as part of the JSON response. Errors come back as follows,

```
    {
        error: [
          "syntax error at or near "LIMIT""
        ]
    }
```

You can use these errors to help understand your SQL.


Getting table information
-------------------------

Currently, there is no public method for accessing your table schemas. The
simplest way to get table structure is to access the first row of the data:

    http://entrypoint?q=SELECT * FROM mytable LIMIT 1

Write data to your CartoDB account
----------------------------------

Perform inserts or updates on your data is simple now using your API
key. All you need to do, is supply a correct SQL INSERT or UPDATE
statement for your table along with the api_key parameter for your
account. Be sure to keep these requests private, as anyone with your API
key will be able to modify your tables. A correct SQL insert statement
means that all the columns you want to insert into already exist in
your table, and all the values for those columns are the right type
(quoted string, unquoted string for geoms and dates, or numbers).

INSERT

    http://entrypoint?q=INSERT INTO test_table (column_name, column_name_2, the_geom) VALUES ('this is a string', 11, ST_SetSRID(ST_Point(-110, 43),4326))&api_key={Your API key}

Updates are just as simple. Here is an example, updating a row based on
the value of the cartodb_id column.

UPDATE

    http://entrypoint?q=UPDATE test_table SET column_name = 'my new string value' WHERE cartodb_id = 1 &api_key={Your API key}


