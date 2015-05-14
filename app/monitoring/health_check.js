var step = require('step'),
    fs   = require('fs');

function HealthCheck(metadataBackend) {
    this.metadataBackend = metadataBackend;
}

module.exports = HealthCheck;

HealthCheck.prototype.check = function(username, query, callback) {
    var result = {
            redis: {},
            postgresql: {}
        };

    step(
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
