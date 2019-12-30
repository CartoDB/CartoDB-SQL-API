'use strict';

var PSQL = require('cartodb-psql');

function QueryRunner (userDatabaseMetadataService, logger) {
    this.userDatabaseMetadataService = userDatabaseMetadataService;
    this.logger = logger;
}

module.exports = QueryRunner;

function hasDBParams (dbparams) {
    return (dbparams.user && dbparams.host && dbparams.port && dbparams.dbname && dbparams.pass);
}

QueryRunner.prototype.run = function (jobId, sql, user, timeout, dbparams, callback) {
    if (hasDBParams(dbparams)) {
        return this._run(dbparams, jobId, sql, timeout, callback);
    }

    const dbConfigurationError = new Error('Batch Job DB misconfiguration');

    return callback(dbConfigurationError);
};

QueryRunner.prototype._run = function (dbparams, jobId, sql, timeout, callback) {
    var pg = new PSQL(dbparams);
    this.logger.debug('Running query [timeout=%d] %s', timeout, sql);
    pg.query(`/* ${jobId} */ ${sql}`, callback, false, timeout);
};
