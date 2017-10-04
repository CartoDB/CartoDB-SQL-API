# Creating Tables with the SQL API

[Writing data to your CARTO account](https://carto.com/docs/carto-engine/sql-api/making-calls#write-data-to-your-carto-account) enables you to manage data through SQL queries, it does not automatically connect tables as datasets to _Your datasets_ dashboard in CARTO.

You must apply the `CDB_CartodbfyTable`function to a target table in order to create and display connected datasets in your account. This additional step of "CARTOfying" data is the process of converting an arbitrary PostgreSQL table into a valid CARTO table, and registering it into the system so that it can be used in the graphical user interface, and the CARTO Engine, to generate maps and analysis.

## Create Tables

To create a visible table in CARTO, run the following SQL query with the SQL API:

```bash
CREATE TABLE {table_name}
 (
 {column1} {data type},
 {column2} {data type},
 {column3} {data type},
 ...
 );
```

While this begins the process of creating the structure for the table, it is still not visible in your dashboard. Run the following request to make the table visible.

```bash
SELECT cdb_cartodbfytable({table_name});
```

**Tip:** If you are an developer using an Enterprise account, you must also include the organization username as part of the request. For example:

```bash
SELECT cdb_cartodbfytable({org_username}, {table_name});
```

The table is created and added as a connected dataset in _Your datasets_ dashboard. Refresh your browser to ensure that you can visualize it in your account. Once a table is connected to _Your datasets_ dashboard in CARTO, any modifications that you apply to your data through the SQL API are automatically updated.

## Rename Tables

To rename a connected dataset in _Your datasets_ dashboard, run the following SQL query with the SQL API:

```bash
ALTER TABLE {table_name} RENAME to {renamed table_name};
```

It may take a few seconds for the connected table to appear renamed. Refresh your browser to ensure that you can visualize the changes in _Your datasets_ dashboard. 

## Remove a Table

If you remove a table, **any maps using the connected dataset will be affected**. The deleted dataset cannot be recovered. Even if you create a new table with the same name as a removed table, CARTO still internalizes it as a different table.

To remove a connected dataset from _Your datasets_ dashboard, run the following SQL query with the SQL API:

```bash
DROP TABLE {table_name};
```

This removes the connected table from _Your datasets_ dashboard. Refresh your browser to ensure that the connected dataset was removed. 
