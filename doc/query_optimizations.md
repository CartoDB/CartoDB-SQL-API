# Query Optimizations

There are some tricks to consider when using the SQL API that might make your application a little faster.

* Only request the fields you need. Selecting all columns will return a full version of your geometry in *the_geom*, as well as a reprojected version in *the_geom_webmercator*.
* Use PostGIS functions to simplify and filter out unneeded geometries when possible. One very handy function is, [ST_Simplify](http://www.postgis.org/docs/ST_Simplify.html).
* Remember to build indexes that will speed up some of your more common queries. For details, see [Creating Indexes](http://docs.cartodb.com/cartodb-editor/managing-your-data/#creating-indexes)
* Use *cartodb_id* to retrieve specific rows of your data, this is the unique key column added to every CartoDB table.

<!-- TODO: Link to http://blog.cartodb.com/post/53301057653/faster-data-updates-with-cartodb -->
