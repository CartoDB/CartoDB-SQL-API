'use strict';

var PSQL = require('cartodb-psql');

function QueryRunner(userDatabaseMetadataService) {
    this.userDatabaseMetadataService = userDatabaseMetadataService;
}

module.exports = QueryRunner;

QueryRunner.prototype.run = function (job_id, sql, user, callback) {
    this.userDatabaseMetadataService.getUserMetadata(user, function (err, userDatabaseMetadata) {
        if (err) {
            return callback(err);
        }

        var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

        pg.query('SET statement_timeout=0', function (err) {
            if(err) {
                return callback(err);
            }

            // mark query to allow to users cancel their queries
            sql = '/* ' + job_id + ' */ ' + sql;

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
