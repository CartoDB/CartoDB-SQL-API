# Batch Queries

This document describes features from Batch Queries, it also details some internals that might be useful for maintainers
and developers.


## Redis data structures

### Jobs definition

Redis Hash: `batch:jobs:{UUID}`.

Redis DB: global.settings.batch_db || 5.

It stores the job definition, the user, and some metadata like the final status, the failure reason, and so.

### Job queues

Redis List: `batch:queue:{username}`.

Redis DB: global.settings.batch_db || 5.

It stores a pending list of jobs per user. It points to a job definition with the `{UUID}`.

### Job notifications

Redis Pub/Sub channel: `batch:users`.

Redis DB: 0.

In order to notify new jobs, it uses a Pub/Sub channel were the username for the queued job is published.


## Job types

Format for the currently supported query types, and what they are missing in terms of features.

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
