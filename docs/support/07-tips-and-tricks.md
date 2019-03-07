## Other Tips and Questions

### What does CARTO do to prevent SQL injection?

CARTO uses the database access mechanism for security. Every writable connection is verified by an API Key. If you have the correct API Key, you can write-access to the database. If you do not have the correct API Key, your client is "logged in" as a low privilege user, and you have read-only access to the database (if the database allows you to read).

SQL injection works by tricking a database user, so that running a query retrieves database wide results, even though the database is protected.

Because CARTO enforces roles and access at the database level, the idea of a "SQL injection attack" is not possible with CARTO. Injection is possible, but clients will still run into our security wall at the database level. The SQL API already lets you _attempt_ to run any query you want. The database will reject your SQL API request if it finds your user/role does not have the requisite permissions. In other words, you can ask any question of the database you like; the CARTO Engine does not guarantee it will be answered.

If a user's API Key found its way out into the wild, that could be a problem, but it is not something CARTO can prevent. _This is why it is very important for all CARTO users to secure their API Keys_. In the event a user's API Key is compromised, the user (or the CARTO Enterprise administrator), can regenerate the API Key in their account settings.

**Note:** While the SQL API is SQL injection secure, if you build additional layers to allow another person to run queries (i.e., building a proxy so that others can indirectly perform authenticated queries through the SQL API), the security of those newly added layers are the responsibility of the creator.

### What levels of database access can roles/users have?

There are three levels of access with CARTO:

1. __API Key level:__ Do whatever you want in your account on the tables you own (or have been shared with you in Enterprise/multi-user accounts).
2. __"publicuser" level:__ Do whatever has been granted to you. The publicuser level is normally read-only, but you could GRANT INSERT/UPDATE/DELETE permissions to publicuser if needed for some reason - for API Key-less write operations. Use with caution.
3. __postgres superadmin level:__ This third access level, the actual PostgreSQL system user, is only accessible from a direct database connection via the command line, which is only available currently via [CARTO On-Premises](https://carto.com/on-premises/).

### If a user has write access and makes a `DROP TABLE` query, is that data gone?

Yes. Grant write access with caution and keep backups of your data elsewhere / as duplicate CARTO tables.

### Is there a permission available where a user can write but not `DROP` or `DELETE`?

Yes. Create the table, and GRANT INSERT/UPDATE to the user.

### Is there an actual PostgreSQL account for each CARTO login/username?

Yes, there is. Unfortunately, the names are different - though there is a way to determine the name of the PostgreSQL user account. Every CARTO user gets their own PostgreSQL database. But there is a system database too, with the name mappings in `username` and `database_name` columns. `database_name` is the name of the database that user belongs to. It will be `cartodb_user_ID`. `id` holds long hashkey. The `database_name` is derived from this ID hash too, but in case of an Enterprise/multi-user account it will come from the user ID of the owner of the organization - and `database_name` will hold the same value for every user in an Enterprise/multi-user account.

You can also just do `select user` using the SQL API (without an API Key to get the publicuser name and with an API Key to get the CARTO user's PostgreSQL user name), to determine the name of the corresponding PostgreSQL user.

### Can I configure my CARTO database permissions exactly the same way I do on my own PostgreSQL instance?

Yes, through using GRANT statements to the SQL API. There are a few caveats to be aware of, including the aforementioned naming differences. Also, you will be limited to permissions a user has with their own tables. Users do not have PostgreSQL superuser privileges. So they cannot be creating languages, or C functions, or anything that requires superuser or CREATEUSER privileges.

### How can I export CARTO datasets with the SQL API?

You can use the SQL API to run any query and export the results in different formats, such as a CSV or GeoPackage. This is helpful for accessing your datasets offline.

**Note:** View the [response formats]({{ site.sqlapi_docs }}/guides/making-calls/#response-formats) that are available with the SQL API and ensure that your dataset does not exceed the maximum file size for [SQL API exports](https://carto.com/help/getting-started/limits/#sql-api-limits).

#### Export Datasets as a GeoPackage

You can easily export CARTO datasets using the [GeoPackage](http://www.geopackage.org/) file format, which is an "open, standards-based, platform-independent, portable, self-describing, compact format for transferring geospatial information- &copy;". A .gpkg file itself is a [type](http://www.geopackage.org/spec/#table_column_data_types) of database, more complex than a plain file.

**Tip:** _GeoPackage is the recommended format since it exports your dataset in smaller pieces;_ typically avoiding error messages that might appear due to long file names and/or large datasets. If exporting a map with the SQL API, the `GPKG` format does not include any visualization or styling, which helps reduce the file size during the export process.

```bash
https://{username}.carto.com/api/v2/sql?q=SELECT * FROM {table_name}&format=gpkg&filename={file_name}.gpkg
```

The response is `file_name.gpkg` that you can download for use offline.

##### Example of `GPKG` File

- From your Internet browser, copy and paste the following link into a new tab and press Enter.

```bash
https://builder-demo.carto.com/api/v2/sql?q=SELECT+*+FROM+san_francisco_airbnbs&format=gpkg&filename=san_francisco_airbnbs.gpkg
```

A gpkg file is downloaded, based on your web browser process, and available for use offline.


#### Download Datasets as a URL

You can use your table URL to run a response query and export downloads in different formats. For example, the following sample code shows the CSV export format for an SQL API request.


```bash
https://{username}.carto.com/api/v2/sql?format=csv&q=SELECT+*+FROM+tm_world_borders_sim
```

The response creates a direct dataset URL that you can download for use offline.

#### Why can't I see my created tables in my CARTO account?

The SQL API automatically displays tables in CARTO if you follow these steps:

- Create a table that has been "cartodbfied", which prepares your table to be compatible with CARTO. View [Creating Tables with the SQL API]({{site.sqlapi_docs}}/guides/creating-tables/#creating-tables-with-the-sql-api) to learn about this function.

- After creating your "cartodbfied" table, you must login to your CARTO account and open _Your datasets_ dashboard. Logging in initiates a check between the database and your account.

**Note:** There is an expected refresh time while the database is checking your account and your tables may not appear at this time, especially if there are a lot of tables or tables with a large amount of rows.

- Once the database updates, CARTO will display your created or changed tables as connected datasets!

#### What happens if I remove a table that is used in an existing map?

If you [drop]({{ site.sqlapi_docs }}/guides/creating-tables/#remove-a-table) a table using the SQL API, be mindful that there is no warning that the table may be used in an existing map. This is by design. Any maps using a removed table will be missing data and thus, will be deleted.

If you are unsure about which tables are connected to maps, it is suggested to remove tables from _Your datasets_ dashboard in CARTO, which automatically notifies you of any connected maps in use.
