require('../helper')

var assert      = require('assert'),
    _           = require('underscore'),
    HealthCheck = require('../../app/monitoring/health_check');

var metadataBackend = {};

function PSQL(dbParams) {
    this.params = dbParams;
}

var healthCheck = new HealthCheck(metadataBackend, PSQL);

suite('health checks', function() {

    test('error if disabled file exists', function(done) {
      var fs = require('fs');

      var readFileFn = fs.readFile;
      fs.readFile = function(filename, callback) {
        callback(null, "Maintenance");
      }
      healthCheck.check('fake', 'select 1', function(err, result) {
        assert.equal(err.message, "Maintenance");
        assert.equal(err.http_status, 503);
        done();
        fs.readFile = readFileFn;
      });
    });

    test('not err if disabled file does not exists', function(done) {
      var fs = require('fs');
      
      var readFileFn = fs.readFile;
      fs.readFile = function(filename, callback) {
        callback(new Error("ENOENT"), null);
      }
      healthCheck.check('fake', 'select 1', function(err, result) {
        assert.equal(err, null);
        done();
        fs.readFile = readFileFn;
      });
    });

});
