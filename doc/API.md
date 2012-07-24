SQL API
=======

CartoDB is based on the rock solid PostgreSQL database. All your tables
are inside a single database which means you can perform complex queries
joining tables or performing complicated geospatial operations. The best
place to learn about PostgreSQL SQL language is the official documentation

CartoDB is also based on PostGIS, so take a look at the official PostGIS
reference to know what functionality we support in terms on geospatial
operations. All our tables include a column called the_geom with the
geometry field and indexes on them in the EPSG:4326 projection. All tables
also have an automatically generated and updated the_geom_webmercator
column that we use internally to create tiles for maps as fast as
possible.

URL endpoints
-------------

All SQL API request to your CaroDB account use this pattern

Pattern

    http://{account}.cartodb.com/api/v2/sql?q={SQL statement}

Be sure you account name is right and that your SQL statement is valid. A
good test is a simple count of all the records in a table,

count

    http://{account}.cartodb.com/api/v2/sql?q=SELECT count(*) FROM {table_name}

result

```
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

Finally, remember that unless you are authenticated your table needs to
be public for the SQL API to work.

POST and GET
------------

The CartoDB SQL API is setup to handle both GET and POST requests. You
can test the GET method directly in your browser. Below is an example
of a JQuery SQL API request to a CartoDB.

```jQuery
    $.getJSON('http://'+your_account_name+'.cartodb.com/api/v2/sql/?q='+sql_statement, function(data){
       $.each(data.rows, function(key, val) {
           // do something!
       });
    }); 
```

By default GET requests work from anywhere. In CartoDB, POST requests
work from any website as well. We achieve this by hosting a cross
domain policy file at the root of all of our servers. This allows you
the greatest level of flexibility when developing your application.

Response formats
----------------

The standard response from the CartoDB SQL API is JSON. If you are
building a web-application, the lightweight JSON format allows you to
quickly integrate data from the SQL API.

example

    http://{account}.cartodb.com/api/v2/sql?q=SELECT * FROM {table_name} LIMIT 1

result

```
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
                created_at: "2012-02-06T22:50:35.778Z",
                updated_at: "2012-02-12T21:34:08.193Z",
                the_geom_webmercator: "0101000020110F000..."
            }
        ]
    }
```

Alternatively, you can use the GeoJSON specification for returning data
from the API. To do so, simply supply the format parameter as GeoJSON,

GeoJSON

    http://{account}.cartodb.com/api/v2/sql?format=GeoJSON&q=SELECT * FROM {table_name} LIMIT 1

result

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

Getting table information
-------------------------

Currently, there is no public method for accessing your table schemas. The
simplest way to get table structure is to access the first row of
the data,

Columns

    http://{account}.cartodb.com/api/v2/sql?q=SELECT * FROM {table_name} LIMIT 1

Response errors
---------------

To help you debug your SQL queries, the CartoDB SQL API returns errors
as part of the JSON response. Errors come back as follows,

Errors

```
    {
        error: [
          "syntax error at or near "LIMIT""
        ]
    }
```

You can use these errors to help understand your SQL, for more complete
documentation see the Error codes and Solutions section of this Users
Guide.

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

    http://{account}.cartodb.com/api/v2/sql?q=INSERT INTO test_table (column_name, column_name_2, the_geom) VALUES ('this is a string', 11, ST_SetSRID(ST_Point(-110, 43),4326))&api_key={Your API key}

Updates are just as simple. Here is an example, updating a row based on
the value of the cartodb_id column.

UPDATE

    http://{account}.cartodb.com/api/v2/sql?q=UPDATE test_table SET column_name = 'my new string value' WHERE cartodb_id = 1 &api_key={Your API key}


