## Batch Queries

A Batch Query enables you to request queries with long-running CPU processing times. Typically, these kind of requests raise timeout errors when using the SQL API. In order to avoid timeouts, you can use Batch Queries to [create](#create-a-job), [read](#read-a-job) and [cancel](#cancel-a-job) queries. You can also run a [chained batch query](#chaining-batch-queries) to chain several SQL queries into one job. A Batch Query schedules the incoming jobs and allows you to request the job status for each query.

_Batch Queries are not intended to be used for large query payloads that contain over 16384 characters (16kb). For instance, if you are inserting a large number of rows into your table, you still need to use the [Import API]({{site.importapi_docs}}/) or [SQL API]({{site.sqlapi_docs}}/guides/) for this type of data management. Batch Queries are specific to queries and CPU usage._

**Note:** SQL API does not expose any endpoint to list Batch Queries (jobs). Thus, when creating a Batch Query (job), you must always save the ID from the response, as the main reference for any later operation.

### Authentication

The Master API Key is required to manage your jobs. The following error message appears if you are not [authenticated]({{ site.sqlapi_docs }}/guides/authentication/):

```bash
{
  "error": [
    "permission denied"
  ]
}
```

In order to get full access, you must use your Master API Key.

Using cURL tool:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": "{query}"
}' "https://{username}.carto.com/api/v2/sql/job?api_key={master_api_key}"
```

Using Node.js request client:

```bash
var request = require("request");

var options = {
  method: "POST",
  url: "https://{username}.carto.com/api/v2/sql/job",
  qs: {
    "api_key": "{master_api_key}"
  },
  headers: {
    "content-type": "application/json"
  },
  body: {
    query: "{query}"
  },
  json: true
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

### Batch Queries Job Schema

A Batch Query request to your CARTO account includes the following job schema elements. _Only the `query` element can be modified._ All other elements of the job schema are defined by the Batch Query and are read-only.

Name | Description
--- | ---
`job_id` | a universally unique identifier (uuid).
`user` | user identifier, as displayed by the username.
`status` | displays the result of the long-running query. The possible status results are:
--- | ---
&#124;_ `pending` | job waiting to be executed.
&#124;_ `running` | indicates that the job is currently running.
&#124;_ `done` | job executed successfully.
&#124;_ `failed` | job executed but failed, with errors.
&#124;_ `canceled` | job canceled by user request.
&#124;_ `unknown` | appears when it is not possible to determine what exactly happened with the job.
`query` | the SQL statement to be executed in a database. _You can modify the select SQL statement to be used in the job schema._<br/><br/>**Tip:** In some scenarios, you may need to retrieve the query results from a finished job. See [Fetching Job Results](#fetching-job-results) for details.
`created_at` | the date and time when the job schema was created.
`updated_at` | the date and time of when the job schema was last updated, or modified.
`failed_reason` | displays the database error message, if something went wrong.

##### Example

```bash
HEADERS: 201 CREATED; application/json
BODY: {
  "job_id": "de305d54-75b4-431b-adb2-eb6b9e546014",
  "user": "cartofante",
  "query": "UPDATE airports SET type = 'international'",
  "status": "pending",
  "created_at": "2015-12-15T07:36:25Z",
  "updated_at": "2015-12-15T07:36:25Z"
}
```

#### Create a Job

To create a Batch Query job, make a POST request with the following parameters.

Creates a Batch Query job request.

```bash
HEADERS: POST /api/v2/sql/job
BODY: {
  "query": "UPDATE airports SET type = 'international'"
}
```

##### Response

```bash
HEADERS: 201 CREATED; application/json
BODY: {
  "job_id": "de305d54-75b4-431b-adb2-eb6b9e546014",
  "user": "cartofante"
  "query": "UPDATE airports SET type = 'international'",
  "status": "pending",
  "created_at": "2015-12-15T07:36:25Z",
  "updated_at": "2015-12-15T07:36:25Z"
}
```

###### POST Examples

If you are using the Batch Query create operation for a cURL POST request, use the following code:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)"
}' "https://{username}.carto.com/api/v2/sql/job"
```

If you are using the Batch Query create operation for a Node.js client POST request, use the following code:

```bash
var request = require("request");

var options = {
  method: "POST",
  url: "https://{username}.carto.com/api/v2/sql/job",
  headers: { "content-type": "application/json" },
  body: {
    query: "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)"
  },
  json: true
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

**Note:** You must always save the `job_id` from the response for any later operation like reading or deleting a job. As mentioned above, SQL API does not expose any endpoint to list jobs.


#### Read a Job

To read a Batch Query job, make a GET request with the following parameters.

```bash
HEADERS: GET /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {}
```

##### Response

```bash
HEADERS: 200 OK; application/json
BODY: {
  "job_id": "de305d54-75b4-431b-adb2-eb6b9e546014",
  "user": "cartofante"
  "query": "UPDATE airports SET type = 'international'",
  "status": "pending",
  "created_at": "2015-12-15T07:36:25Z",
  "updated_at": "2015-12-15T07:36:25Z"
}
```

###### GET Examples

If you are using the Batch Query read operation for a cURL GET request, use the following code:

```bash
curl -X GET "https://{username}.carto.com/api/v2/sql/job/{job_id}"
```

If you are a Batch Query read operation for a Node.js client GET request, use the following code:

```bash
var request = require("request");

var options = {
  method: "GET",
  url: "https://{username}.carto.com/api/v2/sql/job/{job_id}"
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

#### Cancel a Job

To cancel a Batch Query, make a DELETE request with the following parameters.

```bash
HEADERS: DELETE /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {}
```

**Note:** Be mindful when canceling a job when the status: `pending` or `running`.

- If the job is `pending`, the job will never be executed
- If the job is `running`, the job will be terminated immediately

##### Response

```bash
HEADERS: 200 OK; application/json
BODY: {
  "job_id": "de305d54-75b4-431b-adb2-eb6b9e546014",
  "user": "cartofante"
  "query": "UPDATE airports SET type = 'international'",
  "status": "cancelled",
  "created_at": "2015-12-15T07:36:25Z",
  "updated_at": "2015-12-17T06:22:42Z"
}
```

**Note:** Jobs can only be canceled while the `status: "running"` or `status: "pending"`, otherwise the Batch Query operation is not allowed. You will receive an error if the job status is anything but "running" or "pending".

```bash
errors: [
  "The job status is done, cancel is not allowed"
]
```

###### DELETE Examples

If you are using the Batch Query cancel operation for cURL DELETE request, use the following code:

```bash
curl -X DELETE  "https://{username}.carto.com/api/v2/sql/job/{job_id}"
```

If you are using the Batch Query cancel operation for a Node.js client DELETE request, use the following code:

```bash
var request = require("request");

var options = {
  method: "DELETE",
  url: "https://{username}.carto.com/api/v2/sql/job/{job_id}",
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

#### Chaining Batch Queries

In some cases, you may need to chain queries into one job. The Chaining Batch Query option enables you run an array of SQL statements, and define the order in which the queries are executed. You can use any of the operations (create, read, list, update, cancel) for the queries in a chained batch query.

```bash
HEADERS: POST /api/v2/sql/job
BODY: {
  query: [
    "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)",
    "DROP TABLE airports",
    "ALTER TABLE world_airports RENAME TO airport"
  ]
}
```

##### Response

```bash
HEADERS: 201 CREATED; application/json
BODY: {
  "job_id": "de305d54-75b4-431b-adb2-eb6b9e546014",
  "user": "cartofante"
  "query":  [{
    "query": "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)",
    "status": "pending"
  }, {
    "query": "DROP TABLE airports",
    "status": "pending"
  }, {
    "query": "ALTER TABLE world_airports RENAME TO airport",
    "status": "pending"
  }],
  "status": "pending",
  "created_at": "2015-12-15T07:36:25Z",
  "updated_at": "2015-12-15T07:36:25Z"
}
```

**Note:** The Batch Query returns a job status for both the parent Chained Batch Query request, and for each child query within the request. The order in which each query is executed is guaranteed. Here are the possible status results for Chained Batch Queries:

- If one query within the Chained Batch Query fails, the `"status": "failed"` is returned for both the job and the query, and any "pending" queries will not be processed

- If you cancel the Chained Batch Query job, the job status changes to `"status": "cancelled"`. Any running queries within the job will be stopped and changed to `"status": "pending"`, and will not be processed

- Suppose the first query job status is `"status": "done"`, the second query is `"status": "running"`, and the third query `"status": "pending"`. If the second query fails for some reason, the job status changes to `"status": "failed"` and the last query will not be processed. It is indicated which query failed in the Chained Batch Query job

- Creating several jobs does not guarantee that jobs are going to be executed in the same order that they were created. If you need run queries in a specific order, you may want use [Chaining Batch Queries](#chaining-batch-queries).

###### POST Examples

If you are using the Chained Batch Query operation for cURL POST request, use the following code:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": [
    "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)",
    "DROP TABLE airports",
    "ALTER TABLE world_airports RENAME TO airport"
  ]
}' "https://{username}.carto.com/api/v2/sql/job"
```

If you are using the Chained Batch Query operation for a Node.js client POST request, use the following code:

```bash
var request = require("request");

var options = {
  method: "POST",
  url: "https://{username}.carto.com/api/v2/sql/job",
  headers: { "content-type": "application/json" },
  body: {
    "query": [
      "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)",
      "DROP TABLE airports",
      "ALTER TABLE world_airports RENAME TO airport"
    ]
  },
  json: true
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

###### PUT Examples

If you are using the Chained Batch Query operation for cURL PUT request, use the following code:

```bash
curl -X PUT -H "Content-Type: application/json" -d '{
  "query": [
    "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)",
    "DROP TABLE airports",
    "ALTER TABLE world_airports RENAME TO airport",
    "UPDATE airports SET airport = upper(airport)"
  ]
}' "https://{username}.carto.com/api/v2/sql/job/{job_id}"
```

If you are using the Chained Batch Query operation for a Node.js client PUT request, use the following code:

```bash
var request = require("request");

var options = {
  method: "PUT",
  url: "https://{username}.carto.com/api/v2/sql/job/{job_id}",
  headers: { "content-type": "application/json" },
  body: {
    query: [
      "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)",
      "DROP TABLE airports",
      "ALTER TABLE world_airports RENAME TO airport",
      "UPDATE airports SET airport = upper(airport)"
    ]
  },
  json: true
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

### Chaining Batch Queries with fallbacks

When you need to run an extra query based on how a chaining query finished, Batch Queries enable you to define onerror and onsuccess fallbacks. This powerful feature opens a huge range of possibilities, for instance:

- You can create jobs periodically in order to get updated data and create a new table where you can check the status of your tables.

For this example, you can create the following job:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": {
    "query": [{
      "query": "UPDATE nasdaq SET price = '$100.00' WHERE company = 'CARTO'",
      "onsuccess": "UPDATE market_status SET status = 'updated', updated_at = NOW() WHERE table_name = 'nasdaq'"
      "onerror": "UPDATE market_status SET status = 'outdated' WHERE table_name = 'nasdaq'"
    }]
  }
}' "https://{username}.carto.com/api/v2/sql/job"
```

If query finishes successfully, then onsuccess fallback will be fired. Otherwise, onerror will be fired. You can define fallbacks per query:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": {
    "query": [{
      "query": "UPDATE nasdaq SET price = '$101.00' WHERE company = 'CARTO'",
      "onsuccess": "UPDATE market_status SET status = 'updated', updated_at = NOW() WHERE table_name = 'nasdaq'",
      "onerror": "UPDATE market_status SET status = 'outdated' WHERE table_name = 'nasdaq'"
    }, {
      "query": "UPDATE down_jones SET price = '$100.00' WHERE company = 'Esri'",
      "onsuccess": "UPDATE market_status SET status = 'updated', updated_at = NOW() WHERE table_name = 'down_jones'",
      "onerror": "UPDATE market_status SET status = 'outdated' WHERE table_name = 'down_jones'"
    }]
  }
}' "https://{username}.carto.com/api/v2/sql/job"
```

...at the job level..

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": {
    "query": [{
      "query": "UPDATE nasdaq SET price = '$101.00' WHERE company = 'CARTO'"
    }, {
      "query": "UPDATE down_jones SET price = '$100.00' WHERE company = 'Esri'"
    }],
    "onsuccess": "UPDATE market_status SET status = 'updated', updated_at = NOW()",
    "onerror": "UPDATE market_status SET status = 'outdated'"
  }
}' "https://{username}.carto.com/api/v2/sql/job"
```

If a query of a job fails (and onerror fallbacks for that query and job are defined), then Batch Queries runs the first fallback for that query. The job fallback runs next and sets the job as failed. Remaining queries will not be executed. Furthermore, Batch Queries will run the onsuccess fallback at the job level, if (and only if), every query has finished successfully.

#### Templates

Batch Queries provide a simple way to get the error message and the job identifier to be used in your fallbacks defined at the query level, by using the following templates:

 - `<%= error_message %>`: will be replaced by the error message raised by the database.
 - `<%= job_id %>`: will be replaced by the job identifier that Batch Queries provides.

This is helpful when you want to save error messages into a table:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": {
    "query": [{
      "query": "UPDATE wrong_table SET price = '$100.00' WHERE company = 'CARTO'",
      "onerror": "INSERT INTO errors_log (job_id, error_message, date) VALUES ('<%= job_id %>', '<%= error_message %>', NOW())"
    }]
  }
}' "https://{username}.carto.com/api/v2/sql/job"
```

### Fetching Job Results

In some scenarios, you may need to fetch the output of a job. If that is the case, wrap the query with `SELECT * INTO`, or `CREATE TABLE AS`. The output is stored in a new table in your database. For example, if using the query `SELECT * FROM airports`:

1. Wrap the query `SELECT * INTO job_result FROM (SELECT * FROM airports) AS job`

2. [Create a job](#create-a-job), as described previously

3. Once the job is done, fetch the results through the [CARTO SQL API]({{ site.sqlapi_docs }}/guides/), `SELECT * FROM job_result`

**Note:** If you need to create a map or analysis with the new table, use the [CDB_CartodbfyTable function](https://github.com/CartoDB/cartodb-postgresql/blob/master/doc/cartodbfy-requirements.rst).

### Best Practices

For best practices, follow these recommended usage notes when using Batch Queries:

- Batch Queries are recommended for INSERT, UPDATE, and CREATE queries that manipulate and create new data, such as creating expensive indexes, applying updates over large tables, and creating tables from complex queries. Batch queries have no effect for SELECT queries that retrieve data but do not store the results in a table. For example, running a batch query using `SELECT * from my_dataset` will not produce any results.

- Batch Queries are not intended for large query payloads (e.g: inserting thousands of rows), use the [Import API]({{site.importapi_docs}}/) for this type of data management.

- There is a limit of 16kb per job. The following error message appears if your job exceeds this size:

  `Your payload is too large. Max size allowed is 16384 (16kb)`
