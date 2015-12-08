'use strict';

var PSQL = require('cartodb-psql');

function JobDequeuer(databaseDequeuer) {
    this.databaseDequeuer = databaseDequeuer;
}

JobDequeuer.prototype.dequeue = function (callback) {

    this.databaseDequeuer.dequeue(function (err, userDatabase) {
        if (err) {
            return callback(err);
        }

        if (!userDatabase) {
            return callback();
        }

        var pg = new PSQL(userDatabase, {}, { destroyOnError: true });

        var nextQuery = "select * from cdb_jobs where status='pending' order by updated_at asc limit 1";

        pg.query(nextQuery, function (err, job) {
            if (err) {
                return callback(err);
            }

            callback(null, pg, job, userDatabase.host);
        });

    });

};

module.exports = JobDequeuer;
