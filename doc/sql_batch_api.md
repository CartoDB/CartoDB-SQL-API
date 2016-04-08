# SQL Batch API

The SQL Batch API enables you to request queries with long-running processing times. Typically, these kind of requests raise timeout errors when using the SQL API. In order to avoid timeouts, you can use the SQL Batch API to [create](#create-a-job), [read](#read-a-job), [list](#list-jobs), [update](#update-a-job) and [cancel](#cancel-a-job) queries. You can also run [multiple](#multi-query-batch-jobs) SQL queries in one job. The SQL Batch API schedules the incoming jobs and allows you to request the job status for each query.

**Note:** In order to use the SQL Batch API, your table must be public, or you must be [authenticated](http://docs.cartodb.com/cartodb-platform/sql-api/authentication/#authentication) using API keys.

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
`query` | the SQL statement to be executed in a database. _You can modify the select SQL statement to be used in the job schema._<br/><br/>**Tip:** In some scenarios, you may need to retrieve the query results from a finished job. If that is the case, wrap the query with SELECT * INTO, or CREATE TABLE AS. The results will be stored in a new table in your user database. For example:<br/><br/>1. A job query, `SELECT * FROM user_dataset;`<br/><br/>2. Wrap the query, `SELECT * INTO job_result FROM (SELECT * FROM user_dataset) AS job;`<br/><br/>3. Once the table is created, retrieve the results through the CartoDB SQL API, `SELECT * FROM  job_result;`
`created_at` | the date and time when the job schema was created.
`updated_at` | the date and time of when the job schema was last updated, or modified.
`failed_reason` | displays the database error message, if something went wrong.

#### Example

```bash
HEADERS: 201 CREATED; application/json
BODY: {
	 “job_id”: “de305d54-75b4-431b-adb2-eb6b9e546014”,
	 “user”: “cartofante” 
	 “query”: “SELECT * FROM user_dataset”,
	 “status”: “pending”,
	 “created_at”: “2015-12-15T07:36:25Z”,
	 “updated_at”: “2015-12-15T07:36:25Z”
}
```

## Create a Job

To create an SQL Batch API job, make a POST request with the following parameters.

Creates an SQL Batch API job request.

```bash
HEADERS: POST /api/v2/sql/job 
BODY: {
  	  query: ‘SELECT * FROM user_dataset’
}
```

#### Response

```bash
HEADERS: 201 CREATED; application/json
BODY: {
	 “job_id”: “de305d54-75b4-431b-adb2-eb6b9e546014”,
	 “user”: “cartofante” 
	 “query”: “SELECT * FROM user_dataset”,
	 “status”: “pending”,
	 “created_at”: “2015-12-15T07:36:25Z”,
	 “updated_at”: “2015-12-15T07:36:25Z”
}
```

## Read a Job

To read an SQL Batch API job, make a GET request with the following parameters.

```bash
HEADERS: GET /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {}
```

#### Response

```bash
HEADERS: 200 OK; application/json
BODY: {
	 “job_id”: “de305d54-75b4-431b-adb2-eb6b9e546014”,
	 “user”: “cartofante” 
	 “query”: “SELECT * FROM user_dataset”,
	 “status”: “pending”,
	 “created_at”: “2015-12-15T07:36:25Z”,
	 “updated_at”: “2015-12-15T07:36:25Z”
}
```

## List Jobs

To list SQL Batch API jobs, make a GET request with the following parameters.

```bash
HEADERS: GET /api/v2/sql/job
BODY: {}
```

#### Response

```bash
HEADERS: 200 OK; application/json
BODY: [{
	 “job_id”: “de305d54-75b4-431b-adb2-eb6b9e546014”,
	 “user”: “cartofante” 
	 “query”: “SELECT * FROM user_dataset”,
	 “status”: “pending”,
	 “created_at”: “2015-12-15T07:36:25Z”,
	 “updated_at”: “2015-12-15T07:36:25Z”
}, {
	 “job_id”: “ba25ed54-75b4-431b-af27-eb6b9e5428ff”,
	 “user”: “cartofante” 
	 “query”: “DELETE FROM user_dataset”,
	 “status”: “pending”,
	 “created_at”: “2015-12-15T07:43:12Z”,
	 “updated_at”: “2015-12-15T07:43:12Z”
}]
```

## Update a Job

To update an SQL Batch API job, make a PUT request with the following parameters.

```bash
HEADERS: PUT /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {
	 “job_id”: “de305d54-75b4-431b-adb2-eb6b9e546014”,
	 “user”: “cartofante” 
	 “query”: “SELECT cartodb_id FROM user_dataset”,
	 “status”: “pending”,
	 “created_at”: “2015-12-15T07:36:25Z”,
	 “updated_at”: “2015-12-15T07:36:25Z”
}
```

#### Response

```bash
HEADERS: 200 OK; application/json
BODY: {
	 “job_id”: “de305d54-75b4-431b-adb2-eb6b9e546014”,
	 “user”: “cartofante” 
	 “query”: “SELECT cartodb_id FROM user_dataset”,
	 “status”: “pending”,
	 “created_at”: “2015-12-15T07:36:25Z”,
	 “updated_at”: “2015-12-17T15:45:56Z”
}
```

**Note:** Jobs can only be updated while the `status: "pending"`, otherwise the SQL Batch API Update operation is not allowed. You will receive an error if the job status is anything but "pending".

```bash
errors: [
	 “The job status is not pending, it cannot be updated”
]
```

If this is the case, make a PATCH request with the following parameters.

```bash
HEADERS: PATCH /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {
	 “query”: “SELECT cartodb_id FROM user_dataset”,
}
```

## Cancel a Job

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
	 “job_id”: “de305d54-75b4-431b-adb2-eb6b9e546014”,
	 “user”: “cartofante” 
	 “query”: “SELECT * FROM user_dataset”,
	 “status”: “cancelled”,
	 “created_at”: “2015-12-15T07:36:25Z”,
	 “updated_at”: “2015-12-17T06:22:42Z”
}
```

## Multi Query Batch Jobs

In some cases, you may need to run multiple SQL queries in one job. The Multi Query batch option enables you run an array of SQL statements, and define the order in which the queries are executed. You can use any of the operations (create, read, list, update, cancel) for the queries in a Multi Query batch job. 

```bash
HEADERS: POST /api/v2/sql/job 
BODY: {
	 query: [
		   ‘SELECT * FROM user_dataset_0’,
		   ‘SELECT * FROM user_dataset_1’,
		   ‘SELECT * FROM user_dataset_2’
	  ]
}
```

#### Response

```bash
HEADERS: 201 CREATED; application/json
BODY: {
	   “job_id”: “de305d54-75b4-431b-adb2-eb6b9e546014”,
	   “user”: “cartofante” 
	   “query”:  [{
			“query”: “SELECT * FROM user_dataset_0”,
			“status”: “pending”
	   }, {
		    “query”: “SELECT * FROM user_dataset_1”,
		    “status”: “pending”
	   }, {
		    “query”: “SELECT * FROM user_dataset_2”,
			“status”: “pending”
}],
	    “status”: “pending”,
		“created_at”: “2015-12-15T07:36:25Z”,
		“updated_at”: “2015-12-15T07:36:25Z”
}
```

**Note:** The SQL Batch API returns a job status for both the parent Multi Query request, and for each child query within the request. The order in which each query is executed is guaranteed. Here are the possible status results for Multi Query batch jobs: 

- If one query within the Multi Query batch fails, the `"status": "failed"` is returned for both the job and the query, and any "pending" queries will not be processed

- Suppose the first query job status is `"status": "done"`, the second query is `"status": "running"`, and the third query `"status": "pending"`. If the second query fails for some reason, the job status changes to `"status": "failed"` and the last query will not be processed. It is indicated which query failed in the Multi Query batch job

- If you cancel the Multi Query batch job between queries, the job status changes to `"status": "cancelled"` for the Multi Query batch job, but each of the child queries are changed to `"status": "pending"` at the point after it was cancelled. This ensure that no query was cancelled, but the batch array was cancelled
