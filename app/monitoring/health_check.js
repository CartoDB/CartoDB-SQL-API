var Step = require('step'),
    _    = require('underscore');

function HealthCheck(metadataBackend, psqlClass) {
    this.metadataBackend = metadataBackend;
    this.psqlClass = psqlClass;
}

module.exports = HealthCheck;

HealthCheck.prototype.check = function(username, query, callback) {
    var self = this,
        startTime,
        result = {
            redis: {},
            postgresql: {},
            username: username,
            query: query
        };

    Step(
        function getDBParams() {
            startTime = Date.now();
            self.metadataBackend.getAllUserDBParams(username, this);
        },
        function runQuery(err, dbParams) {
            result.redis.ok = !err;
            result.redis.elapsed = Date.now() - startTime;

            if (err) {
                throw err;
            }

            result.redis.count = Object.keys(dbParams).length;

            var psql = new self.psqlClass({
                host: dbParams.dbhost,
                port: global.settings.db_port,
                dbname: dbParams.dbname,
                user: _.template(global.settings.db_user, {user_id: dbParams.dbuser}),
                pass: _.template(global.settings.db_user_pass, {
                    user_id: dbParams.dbuser,
                    user_password: dbParams.dbpass
                })
            });

            startTime = Date.now();
            psql.query(query, this);
        },
        function handleQuery(err, resultSet) {
            result.postgresql.ok = !err;
            if (!err) {
                result.postgresql.elapsed = Date.now() - startTime;
                result.postgresql.count = resultSet.rows.length;
            }
            callback(err, result);
        }
    );
};
