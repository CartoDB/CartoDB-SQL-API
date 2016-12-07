# SQL API

CARTO's SQL API allows you to interact with your tables and data inside CARTO, as if you were running SQL statements against a normal database. The database behind CARTO is PostgreSQL so if you need help with specific SQL statements or you want to learn more about it, visit the [official documentation](http://www.postgresql.org/docs/9.1/static/sql.html).

There are two main situations in which you would want to use the SQL API:

- You want to **insert, update** or **delete** data. For example, you would like to insert a new column with a latitude and longitude data.

- You want to **select** data from public tables in order to use it on your website or in your app. For example, you need to find the 10 closest records to a particular location.

Remember that in order to access, read or modify data in private tables, you will need to authenticate your requests. When a table is public, you can do non-authenticated queries that read data, but you cannot write or modify data without authentication.

## Documentation

* [Authentication](authentication.md)
* [Making calls to the SQL API](making_calls.md)
* [Batch Queries](batch_queries.md)
* [Handling Geospatial Data](handling_geospatial_data.md)
* [Query Optimizations](query_optimizations.md)
* [API Version Vumber](version.md)
* [Libraries in Different Languages](libraries_support.md)
* [Other Tips and Questions](tips_and_tricks.md)
