# SQL Batch API

The SQL Batch API enables you to request queries with long-running CPU processing times. Typically, these kind of requests raise timeout errors when using the SQL API. In order to avoid timeouts, you can use the SQL Batch API to [create](#create-a-job), [read](#read-a-job), [list](#list-jobs), [update](#update-a-job) and [cancel](#cancel-a-job) queries. You can also run [multiple](#multi-query-batch-jobs) SQL queries in one job. The SQL Batch API schedules the incoming jobs and allows you to request the job status for each query.

_The Batch API is not intended to be used for large query payloads than contain over 4096 characters (4kb). For instance, if you are inserting a large number of rows into your table, you still need to use the [Import API](http://docs.cartodb.com/cartodb-platform/import-api/) or [SQL API](http://docs.cartodb.com/cartodb-platform/sql-api/) for this type of data management. The Batch API is specific to queries and CPU usage._

**Note:** In order to use the SQL Batch API, your table must be public, or you must be [authenticated](http://docs.cartodb.com/cartodb-platform/sql-api/authentication/#authentication) using API keys. For details about how to manipulate private datasets with the SQL Batch API, see [Private Datasets](#private-datasets).

## SQL Batch API Job Schema

The SQL Batch API request to your CartoDB account includes the following job schema elements. _Only the `query` element can be modified._ All other elements of the job schema are defined by the SQL Batch API and are read-only.

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

#### Example

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

### Create a Job

To create an SQL Batch API job, make a POST request with the following parameters.

Creates an SQL Batch API job request.

```bash
HEADERS: POST /api/v2/sql/job
BODY: {
  "query": "UPDATE airports SET type = 'international'"
}
```

#### Response

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

##### POST Examples

If you are using the Batch API create operation for cURL POST request, use the following code:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)"
}' "http://{username}.cartodb.com/api/v2/sql/job"
```

If you are using the Batch API create operation for a Node.js client POST request, use the following code:

```bash
var request = require("request");

var options = {
  method: "POST",
  url: "http://{username}.cartodb.com/api/v2/sql/job",
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

### Read a Job

To read an SQL Batch API job, make a GET request with the following parameters.

```bash
HEADERS: GET /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {}
```

#### Response

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

##### GET Examples

If you are using the Batch API read operation for cURL GET request, use the following code:

```bash
curl -X GET "http://{username}.cartodb.com/api/v2/sql/job/{job_id}"
```

If you are using the Batch API read operation for a Node.js client GET request, use the following code:

```bash
var request = require("request");

var options = {
  method: "GET",
  url: "http://{username}.cartodb.com/api/v2/sql/job/{job_id}"
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

### List Jobs

To list SQL Batch API jobs, make a GET request with the following parameters.

```bash
HEADERS: GET /api/v2/sql/job
BODY: {}
```

#### Response

```bash
HEADERS: 200 OK; application/json
BODY: [{
  "job_id": "de305d54-75b4-431b-adb2-eb6b9e546014",
  "user": "cartofante"
  "query": "UPDATE airports SET type = 'international'",
  "status": "pending",
  "created_at": "2015-12-15T07:36:25Z",
  "updated_at": "2015-12-15T07:36:25Z"
}, {
  "job_id": "ba25ed54-75b4-431b-af27-eb6b9e5428ff",
  "user": "cartofante"
  "query": "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)",
  "status": "pending",
  "created_at": "2015-12-15T07:43:12Z",
  "updated_at": "2015-12-15T07:43:12Z"
}]
```

##### GET Examples

If you are using the Batch API list operation for cURL GET request, use the following code:

```bash
curl -X GET "http://{username}.cartodb.com/api/v2/sql/job"
```

If you are using the Batch API list operation for a Node.js client GET request, use the following code:

```bash
var request = require("request");

var options = {
  method: "GET",
  url: "http://{username}.cartodb.com/api/v2/sql/job"
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

### Update a Job

To update an SQL Batch API job, make a PUT request with the following parameters.

```bash
HEADERS: PUT /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {
  "query": "UPDATE airports SET type = 'military'"
}
```

#### Response

```bash
HEADERS: 200 OK; application/json
BODY: {
  "job_id": "de305d54-75b4-431b-adb2-eb6b9e546014",
  "user": "cartofante"
  "query": "UPDATE airports SET type = 'military'",
  "status": "pending",
  "created_at": "2015-12-15T07:36:25Z",
  "updated_at": "2015-12-17T15:45:56Z"
}
```

**Note:** Jobs can only be updated while the `status: "pending"`, otherwise the SQL Batch API Update operation is not allowed. You will receive an error if the job status is anything but "pending".

```bash
errors: [
  "The job status is not pending, it cannot be updated"
]
```

##### PUT Examples

If you are using the Batch API update operation for cURL PUT request, use the following code:

```bash
curl -X PUT -H "Content-Type: application/json" -d '{
  "query": "UPDATE airports SET type = 'military'"
}' "http://{username}.cartodb.com/api/v2/sql/job/{job_id}"
```

If you are using the Batch API update operation for a Node.js client PUT request, use the following code:

```bash
var request = require("request");

var options = {
  method: "PUT",
  url: "http://{username}.cartodb.com/api/v2/sql/job/{job_id}",
  headers: {
    "content-type": "application/json"
  },
  body: { query: "UPDATE airports SET type = 'military'" },
  json: true
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

### Cancel a Job

To cancel an SQL Batch API job, make a DELETE request with the following parameters.

```bash
HEADERS: DELETE /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {}
```

**Note:** Be mindful when cancelling a job when the status: `pending` or `running`.

- If the job is `pending`, the job will never be executed
- If the job is `running`, the job will be terminated immediately

#### Response

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

**Note:** Jobs can only be cancelled while the `status: "running"` or `status: "pending"`, otherwise the SQL Batch API Cancel operation is not allowed. You will receive an error if the job status is anything but "running" or "pending".

```bash
errors: [
  "The job status is done, cancel is not allowed"
]
```

##### DELETE Examples

If you are using the Batch API cancel operation for cURL DELETE request, use the following code:

```bash
curl -X DELETE  "http://{username}.cartodb.com/api/v2/sql/job/{job_id}"
```

If you are using the Batch API cancel operation for a Node.js client DELETE request, use the following code:

```bash
var request = require("request");

var options = {
  method: "DELETE",
  url: "http://{username}.cartodb.com/api/v2/sql/job/{job_id}",
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
```

### Multi Query Batch Jobs

In some cases, you may need to run multiple SQL queries in one job. The Multi Query batch option enables you run an array of SQL statements, and define the order in which the queries are executed. You can use any of the operations (create, read, list, update, cancel) for the queries in a Multi Query batch job.

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

#### Response

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

**Note:** The SQL Batch API returns a job status for both the parent Multi Query request, and for each child query within the request. The order in which each query is executed is guaranteed. Here are the possible status results for Multi Query batch jobs:

- If one query within the Multi Query batch fails, the `"status": "failed"` is returned for both the job and the query, and any "pending" queries will not be processed

- If you cancel the Multi Query batch job, the job status changes to `"status": "cancelled"`. Any running queries within the job will be stopped and changed to `"status": "pending"`, and will not be processed

- Suppose the first query job status is `"status": "done"`, the second query is `"status": "running"`, and the third query `"status": "pending"`. If the second query fails for some reason, the job status changes to `"status": "failed"` and the last query will not be processed. It is indicated which query failed in the Multi Query batch job

##### POST Examples

If you are using the Batch API Multi Query operation for cURL POST request, use the following code:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": [
    "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)",
    "DROP TABLE airports",
    "ALTER TABLE world_airports RENAME TO airport"
  ]
}' "http://{username}.cartodb.com/api/v2/sql/job"
```

If you are using the Batch API Multi Query operation for a Node.js client POST request, use the following code:

```bash
var request = require("request");

var options = {
  method: "POST",
  url: "http://{username}.cartodb.com/api/v2/sql/job",
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

##### PUT Examples

If you are using the Batch API Multi Query operation for cURL PUT request, use the following code:

```bash
curl -X PUT -H "Content-Type: application/json" -d '{
  "query": [
    "CREATE TABLE world_airports AS SELECT a.cartodb_id, a.the_geom, a.the_geom_webmercator, a.name airport, b.name country FROM world_borders b JOIN airports a ON ST_Contains(b.the_geom, a.the_geom)",
    "DROP TABLE airports",
    "ALTER TABLE world_airports RENAME TO airport",
    "UPDATE airports SET airport = upper(airport)"
  ]
}' "http://{username}.cartodb.com/api/v2/sql/job/{job_id}"
```

If you are using the Batch API Multi Query operation for a Node.js client PUT request, use the following code:

```bash
var request = require("request");

var options = {
  method: "PUT",
  url: "http://{username}.cartodb.com/api/v2/sql/job/{job_id}",
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

## Fetching Job Results

In some scenarios, you may need to fetch the output of a job. If that is the case, wrap the query with `SELECT * INTO`, or `CREATE TABLE AS`. The output is stored in a new table in your database. For example, if using the query `SELECT * FROM airports`:

1. Wrap the query `SELECT * INTO job_result FROM (SELECT * FROM airports) AS job`

2. [Create a job](#create-a-job), as described previously

3. Once the job is done, fetch the results through the [CartoDB SQL API](http://docs.cartodb.com/cartodb-platform/sql-api/), `SELECT * FROM job_result`

**Note:**: If you need to create a map or analysis with the new table, use the [CDB_CartodbfyTable function](https://github.com/CartoDB/cartodb-postgresql/blob/master/doc/cartodbfy-requirements.rst).

## Private Datasets

For access to all private tables, and for write access to public tables, an API Key is required to [authenticate]((http://docs.cartodb.com/cartodb-platform/sql-api/authentication/#authentication) your queries with the Batch API. The following error message appears if you are using private tables and are not authenticated:

```bash
{ 
  "error": [ 
    "permission denied"
  ]
}
```

In order to get full access, you must use your API Key.

Using cURL tool:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "query": "{query}"
}' "http://{username}.cartodb.com/api/v2/sql/job?api_key={api_key}"
```

Using Node.js request client:

```bash
var request = require("request");

var options = {
  method: "POST",
  url: "http://{username}.cartodb.com/api/v2/sql/job",
  qs: {
    "api_key": "{api_key}"
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

## Best Practices

For best practices, ensure that you are following these recommended usage notes when using the SQL Batch API:

- The Batch API is not intended for large query payloads (e.g: inserting thousands of rows), use the [Import API](http://docs.cartodb.com/cartodb-platform/import-api/) for this type of data management

- There is a limit of 4kb per job. The following error message appears if your job exceeds this size:
  
  `Your payload is too large. Max size allowed is 4096 (4kb)`

- Only the `query` element of the job scheme can be modified. All other elements of the job schema are defined by the SQL Batch API and are read-only
