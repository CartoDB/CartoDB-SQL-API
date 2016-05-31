# Other Tips and Questions

## What does CARTO do to prevent SQL injection?

CARTO uses the database access mechanism for security. Every writable connection is verified by an API Key. If you have the correct API Key, you can write-access to the database. If you do not have the correct API Key, your client is "logged in" as a low privilege user, and you have read-only access to the database (if the database allows you to read).

SQL injection works by tricking a database user, so that running a query retrieves database wide results, even though the database is protected.

Because CARTO enforces roles and access at the database level, the idea of a "SQL injection attack" is not possible with CARTO. Injection is possible, but clients will still run into our security wall at the database level. The SQL API already lets you _attempt_ to run any query you want. The database will reject your SQL API request if it finds your user/role does not have the requisite permissions. In other words, you can ask any question of the database you like; the CARTO Engine does not guarantee it will be answered.

If a user's API Key found its way out into the wild, that could be a problem, but it is not something CARTO can prevent. _This is why it is very important for all CARTO users to secure their API Keys_. In the event a user's API Key is compromised, the user (or the CARTO Enterprise administrator), can regenerate the API Key in their account settings.

**Note:** While the SQL API is SQL injection secure, if you build additional layers to allow another person to run queries (i.e., building a proxy so that others can indirectly perform authenticated queries through the SQL API), the security of those newly added layers are the responsibility of the creator.

## What levels of database access can roles/users have?

There are three levels of access with CARTO:

1. __API Key level:__ Do whatever you want in your account on the tables you own (or have been shared with you in Enterprise/multi-user accounts).
2. __"publicuser" level:__ Do whatever has been granted to you. The publicuser level is normally read-only, but you could GRANT INSERT/UPDATE/DELETE permissions to publicuser if needed for some reason - for API Key-less write operations. Use with caution.
3. __postgres superadmin level:__ This third access level, the actual PostgreSQL system user, is only accessible from a direct database connection via the command line, which is only available currently via [CARTO On-Premises](https://carto.com/on-premises/).

## If a user has write access and makes a `DROP TABLE` query, is that data gone?

Yes. Grant write access with caution and keep backups of your data elsewhere / as duplicate CARTO tables.

## Is there an in between where a user can write but not `DROP` or `DELETE`?

Yes. Create the table, and GRANT INSERT/UPDATE to the user.

## Is there an actual PostgreSQL account for each CARTO login/username?

Yes, there is. Unfortunately, the names are different - though there is a way to determine the name of the PostgreSQL user account. Every CARTO user gets their own PostgreSQL database. But there is a system database too, with the name mappings in `username` and `database_name` columns. `database_name` is the name of the database that user belongs to. It will be `cartodb_user_ID`. `id` holds long hashkey. The `database_name` is derived from this ID hash too, but in case of an Enterprise/multi-user account it will come from the user ID of the owner of the organization - and `database_name` will hold the same value for every user in an Enterprise/multi-user account.

You can also just do `select user` using the SQL API (without an API Key to get the publicuser name and with an API Key to get the CARTO user's PostgreSQL user name), to determine the name of the corresponding PostgreSQL user.

## Can I configure my CARTO database permissions exactly the same way I do on my own PostgreSQL instance?

Yes, through using GRANT statements to the SQL API. There are a few caveats to be aware of, including the aforementioned naming differences. Also, you will be limited to permissions a user has with their own tables. Users do not have PostgreSQL superuser privileges. So they cannot be creating languages, or C functions, or anything that requires superuser or CREATEUSER privileges.
