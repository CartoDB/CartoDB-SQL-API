# SQL Batch API

The SQL Batch API supports a REST endpoint for long-running queries. This is useful for evaluating any timeouts due to endpoint fails. You can use the SQL Batch API to [create](#create-a-job), [read](#read-a-job), [list](#list-jobs), [update](#update-a-job) and [delete](#delete-a-job). Job instances are stored on a [Redis server and contain a TTL key](http://redis.io/commands/ttl), which CartoDB has defined to timeout at 48 hours after a job resolution. You can then use the list results for job scheduling, which implements First-In First-Out (FIFO) queue rules.


## SQL Batch API Job Schema

The SQL Batch API request to your CartoDB account should include the following elements, that represent the job schema for long-running queries:

Name | Description
--- | ---
`job_id` | a universally unique identifier (uuid).
`user_id` | user identifier, as displayed by the username.
`status` | displays the result of the long-running query. The possible status results are:
--- | ---
&#124;_ `pending` | job waiting to be executed (daily, weekly jobs).
&#124;_ `running` | indicates that the job is currently running.
&#124;_ `done` | job executed successfully.
&#124;_ `failed` | job executed but failed, with errors.
&#124;_ `canceled` | job canceled by user request.
&#124;_ `unknown` | appears when it is not possible to determine what exactly happened with the job. For example, if draining before exit has failed.
`query` | the SQL statement to be executed in a database. You can modify the select SQL statement to be used in the job schema.<br/><br/>**Tip:** You can retrieve a query with outputs (SELECT) or inputs (INSERT, UPDATE and DELETE). In some scenarios, you may need to retrieve the query results from a finished job. If that is the case, wrap the query with SELECT * INTO, or CREATE TABLE AS. The results will be stored in a new table in your user database. For example:<br/><br/>1. A job query, `SELECT * FROM user_dataset;`<br/><br/>2. Wrap the query, `SELECT * INTO job_result FROM (SELECT * FROM user_dataset) AS job;`<br/><br/>3. Once the table is created, retrieve the results through the CartoDB SQL API, `SELECT * FROM  job_result;`
`created_at` | the date and time when the job schema was created.
`updated_at` | the date and time of when the job schema was updated, or modified.
`failed_reason` | displays the database error message, if something went wrong.

**Note:** Only the `query` element can be modified by the user. All other elements of the job schema are not editable.

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
  “Job is not pending, it couldn't be updated”
  ]
}
```

If this is the case, make a PATCH request with the following parameters.

```bash
HEADERS: PATCH /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {
“query”: “SELECT cartodb_id FROM user_dataset”,
}
```

## Delete a Job

To delete and cancel an SQL Batch API job, make a DELETE request with the following parameters.

```bash
HEADERS: DELETE /api/v2/sql/job/de305d54-75b4-431b-adb2-eb6b9e546014
BODY: {}
```

**Note:** Be mindful when deleting a job when the status: `pending` or `running`.

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
