## Metrics

SQL API provides you with a set of operations to handle metrics. You are able to manage timer operations that allow you to analyze the time spent in your queries, and counter operations that allow you to measure the number of successful and failed queries.

### Timers
- **sqlapi.query**: time to return a query resultset from the API, splitted into:
    + **sqlapi.query.init**: time to prepare params from the request
    + **sqlapi.query.getDBParams**: time to retrieve the database connection params
    + **sqlapi.query.authenticate**: time to determine if request is authenticated
    + **sqlapi.query.setDBAuth**: time to set the authenticated connection params
    + **sqlapi.query.queryExplain**: time to retrieve affected tables from the query
    + **sqlapi.query.eventedQuery**: (pg) Time to prepare and execute the query
    + **sqlapi.query.beforeSink**: time to start sending the response.
    + **sqlapi.query.gotRows**: Time until it finished processing all rows in the resultset.
    + **sqlapi.query.generate**: Time to prepare and generate a response from ogr
    + **sqlapi.query.finish**: time to handle an exception

### Counters
- **sqlapi.query.success**: number of successful queries
- **sqlapi.query.error**: number of failed queries
