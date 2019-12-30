'use strict';

require('../helper');

var assert = require('assert');
var HealthCheck = require('../../lib/monitoring/health-check');

var metadataBackend = {};

function PSQL (dbParams) {
    this.params = dbParams;
}

var healthCheck = new HealthCheck(metadataBackend, PSQL);

describe('health checks', function () {
    it('errors if disabled file exists', function (done) {
        var fs = require('fs');

        var readFileFn = fs.readFile;
        fs.readFile = function (filename, callback) {
            callback(null, 'Maintenance');
        };
        healthCheck.check(function (err) {
            assert.strictEqual(err.message, 'Maintenance');
            assert.strictEqual(err.http_status, 503);
            fs.readFile = readFileFn;
            done();
        });
    });

    it('does not err if disabled file does not exists', function (done) {
        var fs = require('fs');

        var readFileFn = fs.readFile;
        fs.readFile = function (filename, callback) {
            callback(new Error('ENOENT'), null);
        };
        healthCheck.check(function (err) {
            assert.strictEqual(err, undefined);
            fs.readFile = readFileFn;
            done();
        });
    });
});
