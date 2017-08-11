'use strict';

var PSQL = require('cartodb-psql');
var debug = require('./util/debug')('query-runner');

function QueryRunner(userDatabaseMetadataService) {
    this.userDatabaseMetadataService = userDatabaseMetadataService;
}

module.exports = QueryRunner;

QueryRunner.prototype.run = function (job_id, sql, user, timeout, callback) {
    this.userDatabaseMetadataService.getUserMetadata(user, function (err, userDatabaseMetadata) {
        if (err) {
            return callback(err);
        }

        var pg = new PSQL(userDatabaseMetadata);

        pg.query('SET statement_timeout=' + timeout, function (err) {
            if(err) {
                return callback(err);
            }

            // mark query to allow to users cancel their queries
            sql = '/* ' + job_id + ' */ ' + sql;

            debug('Running query [timeout=%d] %s', timeout, sql);
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
    });
};
