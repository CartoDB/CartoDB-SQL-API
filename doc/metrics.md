CartoDB-SQL-API metrics
=======================

- **sqlapi.query**: time to return a query resultset from the API, splitted into:
    + **sqlapi.query.init**: time to prepare params from the request
    + **sqlapi.query.getDatabaseName**: time to retrieve the database associated to the query
    + **sqlapi.query.verifyRequest_apikey**: time to retrieve user and verify access with api key
    + **sqlapi.query.verifyRequest_oauth**: time to retrieve user and verify access with oauht
    + **sqlapi.query.getUserDBHost**: time to retrieve the host for the database
    + **sqlapi.query.getUserDBPass**: time to retrieve the user password for the database connection
    + **sqlapi.query.queryExplain**: time to retrieve affected tables from the query
    + **sqlapi.query.setHeaders**: time to set the headers
    + **sqlapi.query.sendResponse**: time to start sending the response.
    + **sqlapi.query.finish**: time to handle an exception
    + **sqlapi.query.startStreaming**: (json) time to start streaming, from the moment the query it was requested.
        * It's not getting into graphite right now.
    + **sqlapi.query.gotRows**: (json) Time until it finished processing all rows in the resultset.
        * It's sharing the key with pg so stats in graphite can have mixed numbers.
    + **sqlapi.query.endStreaming** (json) Time to finish the preparation of the response data.
        * It's not getting into graphite right now.
    + **sqlapi.query.generate**: (ogr) Time to prepare and generate a response from ogr
    + **sqlapi.query.gotRows**: (pg) Time until it finished processing all rows in the resultset.
        *  It's sharing the key with json so stats in graphite can have mixed numbers.
    + **sqlapi.query.packageResult**: (pg) Time to transform between different formats
        * It's not getting into graphite right now.
    + **sqlapi.query.eventedQuery**: (pg) Time to prepare and execute the query
- **sqlapi.query.success**: number of successful queries
- **sqlapi.query.error**: number of failed queries
