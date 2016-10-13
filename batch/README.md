# Batch Queries

This document describes the currently supported query types, and what they are missing in terms of features.

## Job types

### Simple

```json
{
    "query": "update ..."
}
```

Does not support main fallback queries. Ideally it should support something like:

```json
{
    "query": "update ...",
    "onsuccess": "select 'general success fallback'",
    "onerror": "select 'general error fallback'"
}
```

### Multiple

```json
{
    "query": [
        "update ...",
        "select ... into ..."
    ]
}
```

Does not support main fallback queries. Ideally it should support something like:

```json
{
    "query": [
        "update ...",
        "select ... into ..."
    ],
    "onsuccess": "select 'general success fallback'",
    "onerror": "select 'general error fallback'"
}
```

### Fallback

```json
{
    "query": {
        "query": [
            {
                "query": "select 1",
                "onsuccess": "select 'success fallback query 1'",
                "onerror": "select 'error fallback query 1'"
            },
            {
                "query": "select 2",
                "onerror": "select 'error fallback query 2'"
            }
        ],
        "onsuccess": "select 'general success fallback'",
        "onerror": "select 'general error fallback'"
    }
}
```

It's weird to have two nested `query` attributes. Also, it's not possible to mix _plain_ with _fallback_ ones.
Ideally it should support something like:

```json
{
    "query": [
        {
            "query": "select 1",
            "onsuccess": "select 'success fallback query 1'",
            "onerror": "select 'error fallback query 1'"
        },
        "select 2"
    ],
    "onsuccess": "select 'general success fallback'",
    "onerror": "select 'general error fallback'"
    }
}
```

Where you don't need a nested `query` attribute, it's just an array as in Multiple job type, and you can mix objects and
plain queries.
