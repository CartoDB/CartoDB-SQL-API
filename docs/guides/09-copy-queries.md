## Copy Queries

Copy queries allow you to use the [PostgreSQL copy command](https://www.postgresql.org/docs/10/static/sql-copy.html) for efficient streaming of data to and from CARTO.

The support for copy is split across two API end points:

* `https://{username}.carto.com/api/v2/sql/copyfrom` for uploading data to CARTO
* `https://{username}.carto.com/api/v2/sql/copyto` for exporting data out of CARTO

### Copy From

The PostgreSQL `COPY` command is extremely fast, but requires very precise inputs:

* A `COPY` command that describes the table and columns of the upload file, and the format of the file.
* An upload file that exactly matches the `COPY` command.

If the `COPY` command, the supplied file, and the target table do not all match, the upload will fail.

"Copy from" copies data "from" your file, "to" CARTO. "Copy from" uses chunked encoding (`Transfer-Encoding: chunked`) to stream an upload file to the server. This avoids limitations around file size and any need for temporary storage: the data travels from your file straight into the database.

Parameter | Description
--- | ---
`api_key` | a write-enabled key
`q` | the `COPY` command to load the data

**The actual COPY file content must be sent as the body of the POST request.**

Composing a chunked POST is moderately complicated, so most developers will use a tool or scripting language to upload data to CARTO via "copy from". 

#### Example

For a table to be readable by CARTO, it must have a minimum of three columns with specific data types:

* `cartodb_id`, a `serial` primary key
* `the_geom`, a `geometry` in the ESPG:4326 projection (aka long/lat)
* `the_geom_webmercator`, a `geometry` in the ESPG:3857 projection (aka web mercator)

Creating a new CARTO table with all the right triggers and columns can be tricky, so here is an example:

    -- create the table using the *required* columns and a
    -- couple more
    CREATE TABLE upload_example (
        the_geom geometry,
        name text,
        age integer
    );

    -- adds the 'cartodb_id' and 'the_geom_webmercator'
    -- adds the required triggers and indexes
    SELECT CDB_CartodbfyTable('upload_example');
    
    -- Note that CDB_CartodbfyTable is called differently if you have an organization user
    -- SELECT CDB_CartodbfyTable('your_org_username', 'upload_example');

Now you are ready to upload your file. Suppose you have a CSV file like this:

    the_geom,name,age
    SRID=4326;POINT(-126 54),North West,89
    SRID=4326;POINT(-96 34),South East,99
    SRID=4326;POINT(-6 -25),Souther Easter,124

The `COPY` command to upload this file needs to specify the file format (CSV), the fact that there is a header line before the actual data begins, and to enumerate the columns that are in the file so they can be matched to the table columns.

    COPY upload_example (the_geom, name, age)
    FROM STDIN WITH (FORMAT csv, HEADER true)

The `FROM STDIN` option tells the database that the input will come from a data stream, and the SQL API will read our uploaded file and use it to feed the stream.

To actually run upload, you will need a tool or script that can generate a chunked POST, so here are a few examples in different languages.

#### CURL Example

The [curl](https://curl.haxx.se/) utility makes it easy to run web requests from the command-line, and supports chunked POST upload, so it can feed the `copyfrom` end point.

Assuming that you have already created the table, and that the CSV file is named "upload_example.csv":

    curl -X POST \
        -H "Transfer-Encoding: chunked" \
        -H "Content-Type: application/octet-stream" \
        --data-binary @upload_example.csv \
        "https://{username}.carto.com/api/v2/sql/copyfrom?api_key={api_key}&q=COPY+upload_example+(the_geom,+name,+age)+FROM+STDIN+WITH+(FORMAT+csv,+HEADER+true)"

To upload a larger file, using compression for a faster transfer, first compress the file, and then upload it with the content encoding set:

    curl -X POST  \
        -H "Content-Encoding: gzip" \
        -H "Transfer-Encoding: chunked" \
        -H "Content-Type: application/octet-stream" \
        --data-binary @upload_example.csv.gz \
        "https://{username}.carto.com/api/v2/sql/copyfrom?api_key={api_key}&q=COPY+upload_example+(the_geom,+name,+age)+FROM+STDIN+WITH+(FORMAT+csv,+HEADER+true)"


#### Python Example

The [Requests](http://docs.python-requests.org/en/master/user/quickstart/) library for HTTP makes doing a file upload relatively terse.

```python
import requests

api_key = {api_key}
username = {api_key}
upload_file = 'upload_example.csv'
q = "COPY upload_example (the_geom, name, age) FROM STDIN WITH (FORMAT csv, HEADER true)"

url = "https://%s.carto.com/api/v2/sql/copyfrom" % username
with open(upload_file, 'rb') as f:
    r = requests.post(url, params={'api_key': api_key, 'q': q}, data=f, stream=True)

    if r.status_code != 200:
        print(r.text)
    else:
        status = r.json()
        print("Success: %s rows imported" % status['total_rows'])
```

A slightly more sophisticated script could read the headers from the CSV and compose the `COPY` command on the fly.

#### CSV files and column ordering

When using the **CSV format, please note that [PostgreSQL ignores the header](https://www.postgresql.org/docs/10/static/sql-copy.html)**.

> HEADER
>
> Specifies that the file contains a header line with the names of each column in the file. On output, the first line contains the column names from the table, and **on input, the first line is ignored**. This option is allowed only when using CSV format.

If the ordering of the columns does not match the table definition, you must specify it as part of the query.

For example, if your table is defined as:

```sql
CREATE TABLE upload_example (
    the_geom geometry,
    name text,
    age integer
);
```

but your CSV file has the following structure (note `name` and `age` columns are swapped):

```csv
#the_geom,age,name
SRID=4326;POINT(-126 54),89,North West
SRID=4326;POINT(-96 34),99,South East
SRID=4326;POINT(-6 -25),124,Souther Easter
```

your query has to specify the correct ordering, regardless of the header in the CSV:

```sql
COPY upload_example (the_geom, age, name) FROM stdin WITH (FORMAT csv, HEADER true);
```

#### Response Format

A successful upload will return with status code 200, and a small JSON with information about the upload.

    {"time":0.046,"total_rows":10}

A failed upload will return with status code 400 and a larger JSON with the PostgreSQL error string, and a stack trace from the SQL API.

    {"error":["Unexpected field"]}

### Copy To

"Copy to" copies data "to" your desired output file, "from" CARTO.

Using the `copyto` end point to extract data bypasses the usual JSON formatting applied by the SQL API, so it can dump more data, faster. However, it has the restriction that it will only output in a handful of formats:

* PgSQL [text format](https://www.postgresql.org/docs/10/static/sql-copy.html#id-1.9.3.52.9.2),
* [CSV](https://www.postgresql.org/docs/10/static/sql-copy.html#id-1.9.3.52.9.3), and
* PgSQL [binary format](https://www.postgresql.org/docs/10/static/sql-copy.html#id-1.9.3.52.9.4).

"Copy to" is a simple HTTP GET end point, so any tool or language can be easily used to download data, supplying the following parameters in the URL.

Parameter | Description
--- | ---
`api_key` | your API key for reading non-public tables
`q` | the `COPY` command to extract the data
`filename` | filename to put in the "Content-disposition" HTTP header, useful for tools that automatically save the download to a file name


#### CURL Example

The SQL to start a "copy to" can specify

* a table to read,
* a table and subset of columns to read, or
* an arbitrary SQL query to execute and read.

For our example, we'll read back just the three columns we originally loaded:

    COPY upload_example (the_geom, name, age) TO stdout WITH (FORMAT csv, HEADER true)

The SQL needs to be URL-encoded before being embedded in the CURL command, so the final result looks like this:

    curl \
        --output upload_example_dl.csv \
		--compressed \
        "https://{username}.carto.com/api/v2/sql/copyto?q=COPY+upload_example+(the_geom,name,age)+TO+stdout+WITH(FORMAT+csv,HEADER+true)&api_key={api_key}"

#### Python Example

The Python to "copy to" is very simple, because the HTTP call is a simple get. The only complexity in this example is at the end, where the result is streamed back block-by-block, to avoid pulling the entire download into memory before writing to file.

```python
import requests

api_key = {api_key}
username = {api_key}
download_filename = 'download_example.csv'
q = "COPY upload_example (the_geom, name, age) TO stdout WITH (FORMAT csv, HEADER true)"

# request the download
url = "https://%s.carto.com/api/v2/sql/copyto" % username
r = requests.get(url, params={'api_key': api_key, 'q': q}, stream=True)
r.raise_for_status()

with open(download_filename, 'wb') as handle:
    for block in r.iter_content(1024):
        handle.write(block)
print("Downloaded to: %s" % savefilename)
```

### Limits

There's a **5 hours timeout** limit for the `/copyfrom` and `/copyto` endpoints. The idea behind is that, in practice, COPY operations should not be limited by your regular query timeout.

Aside, you cannot exceed your **database quota** in `/copyfrom` operations. Trying to do so will result in a `DB Quota exceeded` error, and the `COPY FROM` transaction will be rolled back.

The maximum payload size of a `/copyfrom` that can be made in a single `POST` request is **limited to 2 GB**. Any attempt exceeding that size will result in a `COPY FROM maximum POST size of 2 GB exceeded` error, and again the whole transaction will be rolled back.
