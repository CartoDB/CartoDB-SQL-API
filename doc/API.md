## SQL API

CartoDB's SQL API allows you to interact with your tables and data inside CartoDB as if you were running SQL statements against a normal database. The database behind CartoDB is PostgreSQL so if you need help with specific SQL statements or you want to learn more about it, visit the [official documentation](http://www.postgresql.org/docs/9.1/static/sql.html).

There are two main situations in which you would want to use the SQL API:

- You want to **insert, update** or **delete** data. For example, you would like to insert a new column with a latitude and longitude data.

- You want to **select** data from public tables in order to use it on your website or in your app. For example, you need to find the 10 closest records to a particular location.

Remember that in order to access, read or modify data in private tables, you will need to authenticate your requests. When a table is public, you can do non-authenticated queries that read data, but you cannot write or modify data without authentication.

## Authentication

For all access to private tables and for write access to public tables, CartoDB enforces secure API access that requires you to authorize your queries. In order to authorize queries, you can use an API key or a Consumer Key.

### API Key

The API key offers the simplest way to access private data or perform writes and updates to your public data. Remember that your API key protects access to your data, so keep it confidential and only share it if you want others to have this access. If necessary, you can reset your API key in your admin dashboard.

To find your API key:

- Go to your dashboard.
- Click on your username in the top right corner, and select "Your API keys."
- Here, you can copy your API key, see use examples, and reset your API key.

To use your API key, pass it as a parameter in an URL call to the CartoDB API. For example, to perform an insert into your table, you would use the following URL structure.

<div class="code-title code-request">Query example with the api_key parameter</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q={SQL statement}&api_key={Your API key}
```

## Making calls to the SQL API

CartoDB is based on the rock solid PostgreSQL database. All of your tables reside a single database, which means you can perform complex queries joining tables or carrying out geospatial operations. The best place to learn about PostgreSQL's SQL language is the [official documentation](http://www.postgresql.org/docs/9.1/static/).

CartoDB is also based on PostGIS, so take a look at the [official PostGIS reference](http://postgis.refractions.net/docs/) to know what functionality we support in terms of geospatial operations. All of our tables include a column called *the_geom,* which is a geometry field that indexes geometries in the EPSG:4326 (WGS 1984) coordinate system. All tables also have an automatically generated and updated column called *the_geom_webmercator*. We use the column internally to quickly create tiles for maps.

### URL endpoints

All SQL API requests to your CartoDB account should follow this general pattern:

<div class="code-title code-request">SQL QUERY EXAMPLE</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q={SQL statement}
```

If you encounter errors, double-check that you are using the correct account name, and that your SQL statement is valid. A simple example of this pattern is conducting a count of all the records in your table:

<div class="code-title code-request with-result">SQL QUERY COUNT EXAMPLE</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q=SELECT count(*) FROM {table_name}
```

<div class="code-title">RESULT</div>
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

Finally, remember that in order to use the SQL API, either your table must be public, or you must be authenticated using API Keys, as discussed above.


### POST and GET

The CartoDB SQL API is setup to handle both GET and POST requests. You can test the GET method directly in your browser. Below is an example of a JQuery SQL API request to CartoDB:

<div class="code-title">JQUERY</div>
```javascript
$.getJSON('https://'+your_account_name+'.cartodb.com/api/v2/sql/?q='+sql_statement, function(data) {
  $.each(data.rows, function(key, val) {
    // do something!
  });
});
```

By default, GET requests work from anywhere. In CartoDB, POST requests work from any website as well. We achieve this by hosting a cross-domain policy file at the root of all of our servers. This allows you the greatest level of flexibility when developing your application.

### Response formats

The standard response from the CartoDB SQL API is JSON. If you are building a web-application, the lightweight JSON format allows you to quickly integrate data from the SQL API.

<div class="code-title code-request with-result">JSON</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q=SELECT * FROM {table_name} LIMIT 1
```

<div class="code-title">RESULT</div>
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

<div class="code-title code-request with-result">GEOJSON</div>
```bash
https://{account}.cartodb.com/api/v2/sql?format=GeoJSON&q=SELECT * FROM {table_name} LIMIT 1
```

<div class="code-title">RESULT</div>
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

The SQL API accepts other output formats that can be useful to export data. Right now you can use the following formats: CSV, SHP, SVG, KML, SpatiaLite and GeoJSON.

### Output filename
To customize the output filename, add the `filename` parameter to your URL:

<div class="code-title code-request with-result">Customize filename</div>
```bash
https://{account}.cartodb.com/api/v2/sql?filename={custom_filename}&q=SELECT * FROM {table_name} LIMIT 1
```

### Getting table information

Currently, there is no public method to access your table schemas. The simplest way to retrieve table structure is to access the first row of the data,

<div class="code-title code-request">COLUMNS</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q=SELECT * FROM {table_name} LIMIT 1
```

### Response errors

To help you debug your SQL queries, the CartoDB SQL API returns errors as part of the JSON response. Errors come back as follows,

<div class="code-title">RESULT</div>
```javascript
{
  error: [
    "syntax error at or near "LIMIT""
  ]
}
```

You can use these errors to help understand your SQL. For more complete documentation see the Error Codes and Solutions section of this Users Guide.

### Write data to your CartoDB account

Performing inserts or updates on your data is simple using your [API key](#authentication). All you need to do is supply a correct SQL [INSERT](http://www.postgresql.org/docs/9.1/static/sql-insert.html) or [UPDATE](http://www.postgresql.org/docs/9.1/static/sql-update.html) statement for your table along with the api_key parameter for your account. Be sure to keep these requests private, as anyone with your API key will be able to modify your tables. A correct SQL insert statement means that all the columns you want to insert into already exist in your table, and all the values for those columns are the right type (quoted string, unquoted string for geoms and dates, or numbers).

<div class="code-title code-request">COLUMNS</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q=INSERT INTO test_table (column_name, column_name_2, the_geom) VALUES ('this is a string', 11, ST_SetSRID(ST_Point(-110, 43),4326))&api_key={Your API key}
```

Updates are just as simple. Here is an example, updating a row based on the value of the cartodb_id column.

<div class="code-title code-request">COLUMNS</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q=UPDATE test_table SET column_name = 'my new string value' WHERE cartodb_id = 1 &api_key={Your API key}
```

## Handling geospatial data

Handling geospatial data through the SQL API is easy! By default, *the_geom* is returned straight from the database, in a format called Well-Known Binary. There are a handful of ways you can transform your geometries into more useful formats.


The first, is to use the format=GeoJSON method described above. Others can be handled through your SQL statements directly. For example, enclosing your the_geom in a function called [ST_AsGeoJSON](http://www.postgis.org/documentation/manual-svn/ST_AsGeoJSON.html) will allow you to use JSON for your data but a GeoJSON string for your geometry column only. Alternatively, using a the [ST_AsText](http://www.postgis.org/documentation/manual-svn/ST_AsGeoJSON.html) function will return your geometry as Well-Known Text.

<div class="code-title code-request with-result">ASGEOJSON</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q=SELECT cartodb_id,ST_AsGeoJSON(the_geom) as the_geom FROM {table_name} LIMIT 1
```

<div class="code-title">RESULT</div>
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


<div class="code-title code-request with-result">ASTEXT</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q=SELECT cartodb_id,ST_AsText(the_geom) FROM {table_name} LIMIT 1
```

<div class="code-title">RESULT</div>
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

More advanced methods exist in the PostGIS library to extract meaningful data from your geometry. Explore the PostGIS documentation and get familiar with functions such as, [ST_XMin](http://www.postgis.org/docs/ST_XMin.html), [ST_XMax](http://www.postgis.org/docs/ST_XMax.html), [ST_AsText](http://www.postgis.org/docs/ST_AsText.html), and more.

All data returned from *the_geom* column is in WGS 84 (EPSG:4326). You can change this quickly and easily on the fly using SQL. For example, if you desire geometries in the Hanoi 1972 (EPSG:4147) projection, you could [ST_Transform](http://www.postgis.org/docs/ST_Transform.html),

<div class="code-title code-request">ASTEXT</div>
```bash
https://{account}.cartodb.com/api/v2/sql?q=SELECT ST_Transform(the_geom,4147) FROM {table_name} LIMIT 1
```

CartoDB also stores a second geometry column, *the_geom_webmercator*. We use this internally to build your map tiles as fast as we can. In the user-interface it is hidden, but it is visible and available for use. In this column we store a reprojected version of all your geometries using Web Mercator (EPSG:3857).

## Query optimizations

There are some tricks to consider when using the SQL API that might make your application a little faster.

* Only request the fields you need. Selecting all columns will return a full version of your geometry in *the_geom* as well as a reprojected version in *the_geom_webmercator*.

* Use PostGIS functions to simplify and filter out unneeded geometries when possible. One very handy function is, [ST_Simplify](http://www.postgis.org/docs/ST_Simplify.html).

* Remember to build indexes that will speed up some of your more common queries. For details, see [Creating Indexes](/cartodb-editor/managing-your-data/#creating-indexes)

* Use *cartodb_id* to retrieve specific rows of your data, this is the unique key column added to every CartoDB table.

<!-- TODO: Link to http://blog.cartodb.com/post/53301057653/faster-data-updates-with-cartodb -->

## API version number

All CartoDB applications use **Version 2** of our APIs. All other APIs are deprecated and will not be maintained or supported. You can check that you are using **Version 2** of our APIs by looking at your request URLS. They should all begin contain **/v2/** in the URLs as follows `https://{account}.cartodb.com/api/v2/`

## Libraries in different languages

To make things easier for developers, we provide client libraries for different programming languages and caching functionalities.

- **R**  
  To help more researchers use CartoDB to drive their geospatial data, we have released the R client library. [Fork it on GitHub!](https://github.com/Vizzuality/cartodb-r)

- **NODE.js**  
  This demo app authenticates with your CartoDB and shows how to perform read and write queries using the SQL API. [Fork it on GitHub!](https://github.com/Vizzuality/cartodb-nodejs)

- **PHP**  
  The PHP library provides a wrapper around the SQL API to get PHP objects straight from SQL calls to CartoDB. [Fork it on GitHub!](https://github.com/Vizzuality/cartodbclient-php)

- **PYTHON**  
  Provides API Key access to SQL API. [Fork it on GitHub!](https://github.com/vizzuality/cartodb-python)

- **JAVA**  
  Very basic example of how to access CartoDB SQL API. [Fork it on GitHub!](https://github.com/cartodb/cartodb-java-client)

- **NET**  
  .NET library for authenticating with CartoDB using an API key, based on work started by [The Data Republic](http://www.thedatarepublic.com/). [Fork it on GitHub!](https://github.com/thedatarepublic/CartoDBClientDotNET)

- **Clojure**  
  Clojure library for authenticating with CartoDB, maintained by [REDD Metrics](http://www.reddmetrics.com/). [Fork it on GitHub!](https://github.com/reddmetrics/cartodb-clj)

- **iOS**  
  Objective-C library for interacting with CartoDB in native iOS applications. [Fork it on GitHub!](https://github.com/jmnavarro/cartodb-objectivec-client)

## Other Tips and Questions

### What does CartoDB do to prevent SQL injection?

CartoDB uses the database access mechanism itself for security. Every writable connection is verified by an API key, and if you have the correct API key, you can write to anything the database allows you to write to. If you don’t have the correct API key, your client is "logged in" as a low privilege user, and you can read anything the database allows you to read.

SQL injection works by tricking a database user that is only showing you certain parts of the database to show all of it, or by tricking the database into writing things it shouldn't. This happens when the database connection has perhaps more privileges than you would freely hand out to your API users.

Because CartoDB enforces roles and access at the database level, the idea of a “SQL injection attack” is not possible with CartoDB. Injection is possible, but clients will still run into our security wall at the database level. Put another way, the SQL API already lets you _attempt_ to run any query you want. The database will reject your SQL API request if it finds your user/role doesn't have the requisite permissions. In other words, you can ask any question of the database you like; the CartoDB database doesn’t guarantee it will be answered.

If a user's API key found its way out into the wild, then that would be a problem but is not something CartoDB can prevent. This is why it is very important for all CartoDB users to secure their API keys. In the event a user's API key is compromised, either the user or the CartoDB Enterprise administrator can regenerate the API key in their account settings.

### What levels of database access can roles/users have?

There are three levels of access with CartoDB:

1. __API Key level:__ Do whatever you want in your account on the tables you own (or have been shared with you in Enterprise/multi-user accounts).
2. __"publicuser" level:__ Do whatever has been granted to you. The publicuser level is normally read-only, but you could GRANT INSERT/UPDATE/DELETE permissions to publicuser if needed for some reason - for API key-less write operations. Use with caution.
3. __postgres superadmin level:__ This third access level, the actual PostgreSQL system user, is only accessible from a direct database connection via the command line, which is only available currently via [CartoDB On-Premises](https://cartodb.com/on-premises/).

### If a user has write access and makes a `DROP TABLE` query, is that data gone?

Yes. Grant write access with caution and keep backups of your data elsewhere / as duplicate CartoDB tables.

### Is there an in between where a user can write but not `DROP` or `DELETE`?

Yes. Create the table, and GRANT INSERT/UPDATE to the user.

### Is there an actual PostgreSQL account for each CartoDB login/username?

Yes, there is. Unfortunately, the names are different - though there is a way to determine the name of the PostgreSQL user account. Every CartoDB user gets their own PostgreSQL database. But there’s a system database too, with the name mappings in `username` and `database_name` columns. `database_name` is the name of the database that user belongs to. It will be `cartodb_user_ID`. `id` holds long hashkey. The `database_name` is derived from this ID hash too, but in case of an Enterprise/multi-user account it will come from the user ID of the owner of the organization - and `database_name` will hold the same value for every user in an Enterprise/multi-user account.

You can also just do `select user` using the SQL API (without an API key to get the publicuser name and with an API key to get the CartoDB user's PostgreSQL user name), to determine the name of the corresponding PostgreSQL user.

### Could I configure my CartoDB database permissions exactly the same way I could on my own PostgreSQL instance?

Yes, through using GRANT statements to the SQL API. There are a few caveats to be aware of, including the aforementioned naming differences. Also, you'll be limited to permissions a user has with their own tables. Users don’t have PostgreSQL superuser privileges. So they can’t be creating languages, or C functions, or anything that requires superuser or CREATEUSER privileges.
