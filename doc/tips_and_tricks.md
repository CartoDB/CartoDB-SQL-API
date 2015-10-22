# Other Tips and Questions

## What does CartoDB do to prevent SQL injection?

CartoDB uses the database access mechanism itself for security. Every writable connection is verified by an API key, and if you have the correct API key, you can write to anything the database allows you to write to. If you don’t have the correct API key, your client is "logged in" as a low privilege user, and you can read anything the database allows you to read.

SQL injection works by tricking a database user that is only showing you certain parts of the database to show all of it, or by tricking the database into writing things it shouldn't. This happens when the database connection has perhaps more privileges than you would freely hand out to your API users.

Because CartoDB enforces roles and access at the database level, the idea of a “SQL injection attack” is not possible with CartoDB. Injection is possible, but clients will still run into our security wall at the database level. Put another way, the SQL API already lets you _attempt_ to run any query you want. The database will reject your SQL API request if it finds your user/role doesn't have the requisite permissions. In other words, you can ask any question of the database you like; the CartoDB database doesn’t guarantee it will be answered.

If a user's API key found its way out into the wild, then that would be a problem but is not something CartoDB can prevent. This is why it is very important for all CartoDB users to secure their API keys. In the event a user's API key is compromised, either the user or the CartoDB Enterprise administrator can regenerate the API key in their account settings.

## What levels of database access can roles/users have?

There are three levels of access with CartoDB:

1. __API Key level:__ Do whatever you want in your account on the tables you own (or have been shared with you in Enterprise/multi-user accounts).
2. __"publicuser" level:__ Do whatever has been granted to you. The publicuser level is normally read-only, but you could GRANT INSERT/UPDATE/DELETE permissions to publicuser if needed for some reason - for API key-less write operations. Use with caution.
3. __postgres superadmin level:__ This third access level, the actual PostgreSQL system user, is only accessible from a direct database connection via the command line, which is only available currently via [CartoDB On-Premises](https://cartodb.com/on-premises/).

## If a user has write access and makes a `DROP TABLE` query, is that data gone?

Yes. Grant write access with caution and keep backups of your data elsewhere / as duplicate CartoDB tables.

## Is there an in between where a user can write but not `DROP` or `DELETE`?

Yes. Create the table, and GRANT INSERT/UPDATE to the user.

## Is there an actual PostgreSQL account for each CartoDB login/username?

Yes, there is. Unfortunately, the names are different - though there is a way to determine the name of the PostgreSQL user account. Every CartoDB user gets their own PostgreSQL database. But there’s a system database too, with the name mappings in `username` and `database_name` columns. `database_name` is the name of the database that user belongs to. It will be `cartodb_user_ID`. `id` holds long hashkey. The `database_name` is derived from this ID hash too, but in case of an Enterprise/multi-user account it will come from the user ID of the owner of the organization - and `database_name` will hold the same value for every user in an Enterprise/multi-user account.

You can also just do `select user` using the SQL API (without an API key to get the publicuser name and with an API key to get the CartoDB user's PostgreSQL user name), to determine the name of the corresponding PostgreSQL user.

## Could I configure my CartoDB database permissions exactly the same way I could on my own PostgreSQL instance?

Yes, through using GRANT statements to the SQL API. There are a few caveats to be aware of, including the aforementioned naming differences. Also, you'll be limited to permissions a user has with their own tables. Users don’t have PostgreSQL superuser privileges. So they can’t be creating languages, or C functions, or anything that requires superuser or CREATEUSER privileges.
