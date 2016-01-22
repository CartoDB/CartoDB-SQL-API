# Authentication

For all access to private tables and for write access to public tables, CartoDB enforces secure API access that requires you to authorize your queries. In order to authorize queries, you can use an API key or a Consumer Key.

## API Key

The API key offers the simplest way to access private data or perform writes and updates to your public data. Remember that your API key protects access to your data, so keep it confidential and only share it if you want others to have this access. If necessary, you can reset your API key in your admin dashboard.

To find your API key:

- Go to your dashboard.
- Click on your username in the top right corner, and select "Your API keys."
- Here, you can copy your API key, see use examples, and reset your API key.

To use your API key, pass it as a parameter in an URL call to the CartoDB API. For example, to perform an insert into your table, you would use the following URL structure.

#### Example

```bash
https://{account}.cartodb.com/api/v2/sql?q={SQL statement}&api_key={Your API key}
```
