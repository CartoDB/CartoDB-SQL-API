'use strict';

var PSQL = require('cartodb-psql');

function QueryRunner(userDatabaseMetadataService, logger) {
    this.userDatabaseMetadataService = userDatabaseMetadataService;
    this.logger = logger;
}

module.exports = QueryRunner;

function hasDBParams (dbparams) {
    return (dbparams.user && dbparams.host && dbparams.port && dbparams.dbname && dbparams.pass);
}

QueryRunner.prototype.run = function (job_id, sql, user, timeout, dbparams, callback) {
    if (hasDBParams(dbparams)) {
        return this._run(dbparams, job_id, sql, timeout, callback);
    }

    const dbConfigurationError = new Error('Batch Job DB misconfiguration');

    return callback(dbConfigurationError);
};

QueryRunner.prototype._run = function (dbparams, job_id, sql, timeout, callback) {
    var self = this;
    var pg = new PSQL(dbparams);

    pg.query('SET statement_timeout=' + timeout, function (err) {
        if(err) {
            return callback(err);
        }

        // mark query to allow to users cancel their queries
        sql = '/* ' + job_id + ' */ ' + sql;

        self.logger.debug('Running query [timeout=%d] %s', timeout, sql);
        pg.eventedQuery(sql, function (err, query) {
            if (err) {
                return callback(err);
            }

            query.on('error', callback);

            query.on('end', function (result) {
                // only if result is present then query is done sucessfully otherwise an error has happened
                // and it was handled by error listener
                if (result) {
                    callback(null, result);
                }
            });
        });
    });
};
