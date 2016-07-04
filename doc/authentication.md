# Authentication

For all access to private tables, and for write access to public tables, CARTO enforces secure API access that requires you to authorize your queries. In order to authorize queries, you can use an API Key or a Consumer Key.

## API Key

The API Key offers the simplest way to access private data, or perform writes and updates to your public data. Remember that your API Key protects access to your data, so keep it confidential and only share it if you want others to have this access. If necessary, you can reset your API Key from your CARTO dashboard.

**Tip:** For details about how to access, or reset, your API Key, see [Your Account](http://docs.carto.com/carto-editor/your-account/#api-key) details.

To use your API Key, pass it as a parameter in an URL call to the CARTO API. For example, to perform an insert into your table, you would use the following URL structure.

#### Example

```bash
https://{username}.carto.com/api/v2/sql?q={SQL statement}&api_key={api_key}
```
