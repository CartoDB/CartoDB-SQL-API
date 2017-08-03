const TestClient = require('../../support/test-client');

require('../../support/assert');

var assert = require('assert');
var server = require('../../../app/server')();
var querystring = require('querystring');

describe('export timeout', function () {
    beforeEach(function () {
        this.testClient = new TestClient();
    });

    it('CSV export with slow query exceeding statement timeout returns proper error message', function (done) {
        const override = {
            format: 'csv',
            response: {
                status: 429
            }
        };

        this.testClient.getResult('select pg_sleep(2.1) as sleep, 1 as value', override, function (err, res) {
            assert.ifError(err);

            assert.deepEqual(res, {
                error: [
                    'You are over platform\'s limits. Please contact us to know more details'
                ]
            });

            done();
        });
    });
});