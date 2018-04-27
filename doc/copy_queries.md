# Copy Queries

Copy queries allow you to use the [PostgreSQL copy command](https://www.postgresql.org/docs/10/static/sql-copy.html) for efficient streaming of data to and from CARTO.

The support for copy is split across two API end points:

* `http://{username}.carto.com/api/v2/copyfrom` for uploading data to CARTO
* `http://{username}.carto.com/api/v2/copyto` for exporting data out of CARTO

## Copy From

The PostgreSQL `COPY` command is extremely fast, but requires very precise inputs:

* A `COPY` command that describes the table and columns of the upload file, and the format of the file.
* An upload file that exactly matches the `COPY` command.

If the `COPY` command and the target table do not match, the upload will fail.

In addition, for a table to be readable by CARTO, it must have a minimum of three columns with specific data types:

* `cartodb_id`, a `serial` primary key 
* `the_geom`, a geometry in the ESPG:4326 (aka long/lat) projection
* `the_geom_webmercator`, a geometry in the ESPG:3857 (aka web mercator) projection

Creating a new CARTO table with all the right triggers and columns can is tricky, so here is an example:

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
    
Now you are read to upload your file. Suppose you have a CSV file like this:

    the_geom,name,age
    SRID=4326;POINT(-126 54),North West,89
    SRID=4326;POINT(-96 34),South East,99
    SRID=4326;POINT(-6 -25),Souther Easter,124

The `COPY` command to upload this file needs to specify the file format (CSV), the fact that there is a header line before the actual data begins, and enumerate the columns that are in the file so they can be matched to the table columns.

    COPY upload_example (the_geom, name, age) 
    FROM STDIN WITH (FORMAT csv, HEADER true)

The `FROM STDIN` option tells the database that the input will come from a data stream, and the SQL API will read our uploaded file and use it to feed the stream.

To actually run upload, you will need a tool or script that can generate a `multipart/form-data` POST, so here are a few examples in different languages.

### CURL Example

The [curl](https://curl.haxx.se/) utility makes it easy to run web requests from the commandline, and supports multi-part file upload, so it can feed the `copyfrom` end point.

Assuming that you have already created the table, and that the CSV file is named "upload_example.csv":

    curl \
      --form sql="COPY upload_example (the_geom, name, age) FROM STDIN WITH (FORMAT csv, HEADER true)" \
      --form file=@upload_example.csv \
      http://{username}.carto.com/api/v2/copyfrom?api_key={api_key}

**Important:** When supplying the "sql" parameter as a form field, it must come **before** the "file" parameter, or the upload will fail. Alternatively, you can supply the "sql" parameter on the URL line.

### Python Example

The [Requests](http://docs.python-requests.org/en/master/user/quickstart/) library for HTTP makes doing a file upload relatively terse. 

    import requests

    api_key = {api_key}
    username = {api_key}
    upload_file = 'upload_example.csv'
    sql = "COPY upload_example (the_geom, name, age) FROM STDIN WITH (FORMAT csv, HEADER true)"

    url = "http://%s.carto.com/api/v2/copyfrom" % username    
    with open(upload_file, 'rb') as f:
        r = requests.post(url, params={'api_key':api_key, 'sql':sql}, files={'file': f})
        if r.status_code != 200:
            print r.text
        else:
            status = r.json()
            print "Success: %s rows imported" % status['total_rows']

A slightly more sophisticated script could read the headers from the CSV and compose the `COPY` command on the fly.

### Response Format

A successful upload will return with status code 200, and a small JSON with information about the upload.

    {"time":0.046,"total_rows":10}

A failed upload will return with status code 400 and a larger JSON with the PostgreSQL error string, and a stack trace from the SQL API.

    {"error":["Unexpected field"],
     "stack":"Error: Unexpected field
        at makeError (/repos/CartoDB-SQL-API/node_modules/multer/lib/make-error.js:12:13)
        at wrappedFileFilter (/repos/CartoDB-SQL-API/node_modules/multer/index.js:39:19)
        ...
        at emitMany (events.js:127:13)
        at SBMH.emit (events.js:201:7)"}
    
## Copy To

Using the `copyto` end point to extract data bypasses the usual JSON formatting applied by the SQL API, so it can dump more data, faster. However, it has the restriction that it will only output in a handful of formats:

* PgSQL [text format](https://www.postgresql.org/docs/10/static/sql-copy.html#id-1.9.3.52.9.2),
* [CSV](https://www.postgresql.org/docs/10/static/sql-copy.html#id-1.9.3.52.9.3), and
* PgSQL [binary format](https://www.postgresql.org/docs/10/static/sql-copy.html#id-1.9.3.52.9.4).

"Copy to" is a simple HTTP GET end point, so any tool or language can be easily used to download data, supplying the following parameters in the URL:

* `sql`, the "COPY" command to extract the data.
* `filename`, the filename to put in the "Content-disposition" HTTP header. Useful for tools that automatically save the download to a file name.
* `api_key`, your API key for reading non-public tables.


### CURL Example

    curl \
        --output upload_example_dl.csv \
        "http://{username}.carto.com/api/v2/copyfrom?sql=COPY+upload_example+TO+stdout+WITH(FORMAT+csv,HEADER+true)&api_key={api_key}"

### Python Example

    import requests
    import re

    api_key = {api_key}
    username = {api_key}
    download_file = 'upload_example_dl.csv'
    sql = "COPY upload_example (the_geom, name, age) TO stdout WITH (FORMAT csv, HEADER true)"

    # request the download, specifying desired file name
    url = "http://%s.carto.com/api/v2/copyto" % username    
    r = requests.get(url, params={'api_key':api_key, 'sql':sql, 'filename':download_file})
    r.raise_for_status()

    # read save file name from response headers
    d = r.headers['content-disposition']
    savefilename = re.findall("filename=(.+)", d)

    if len(savefilename) > 0:
        with open(savefilename[0], 'wb') as handle:
            for block in r.iter_content(1024):
                handle.write(block)        
        print "Downloaded to: %s" % savefilename
    else:
        print "Error: could not find read file name from headers"

