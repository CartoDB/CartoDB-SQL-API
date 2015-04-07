var Step = require('step'),
    _    = require('underscore'),
    fs   = require('fs');

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
            postgresql: {}
        };

    Step(
        function getManualDisable() {
          fs.readFile(global.settings.disabled_file, this);
        },
        function handleDisabledFile(err, data) {
          var next = this;
          if (err) {
            return next();
          }
          if (!!data) {
            err = new Error(data);
            err.http_status = 503;
            throw err;
          }
        },
        function handleResult(err) {
          callback(err, result);
        }
    );
};
