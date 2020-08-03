# Logging structured traces

In order to have meaningful and useful log traces, you should follow
some general guidelines described in the [Project Guidelines](http://doc-internal.cartodb.net/platform/guidelines.html#structured-logging).

In this project there is a specific logger in place that takes care of
format and context of the traces for you. Take a look at [logger.js](https://github.com/CartoDB/CartoDB-SQL-API/blob/b28835ff56a4b3a98e5273d192d48a81974f5a14/lib/utils/logger.js)
(NOTE: that file will be moved soon to a common module).

The logger is instantiated as part of the [server startup process](https://github.com/CartoDB/CartoDB-SQL-API/blob/b28835ff56a4b3a98e5273d192d48a81974f5a14/lib/server.js#L17),
then passed to middlewares and other client classes.

There are many examples of how to use the logger to generate traces
throughout the code. Here are a few of them:

```
lib/api/middlewares/log-query.js:        logger.info({ sql: ensureMaxQueryLength(res.locals.params.sql) }, 'Input query');
lib/api/middlewares/profiler.js:            logger.info({ stats, duration: stats.response / 1000, duration_ms: stats.response }, 'Request profiling stats');
lib/batch/batch.js:                self.logger.info({ job: job.toJSON() }, 'Batch query job finished');
lib/services/stream-copy-metrics.js:        this.logger.info({ ingestion: logData }, 'Copy to/from query metrics');
```
