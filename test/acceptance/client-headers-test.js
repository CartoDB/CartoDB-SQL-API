'use strict';

const assert = require('../support/assert');
const TestClient = require('../support/test-client');

describe('SQL api metric headers', function () {
    const publicSQL = 'select * from untitle_table_4';

    it('should get client header if client param is present', function (done) {
        this.testClient = new TestClient();
        const params = { client: 'test' };

        this.testClient.getResult(publicSQL, params, (err, result, headers) => {
            assert.ifError(err);
            assert.strictEqual(result.length, 6);
            assert.strictEqual(headers['carto-client'], 'test');
            done();
        });
    });

    it('should not get the client header if no client is provided', function (done) {
        this.testClient = new TestClient();

        this.testClient.getResult(publicSQL, (err, result, headers) => {
            assert.ifError(err);
            assert.strictEqual(result.length, 6);
            assert.strictEqual(headers['carto-client'], undefined);
            done();
        });
    });

    it('should get the user id in the response header', function (done) {
        this.testClient = new TestClient();

        this.testClient.getResult(publicSQL, (err, result, headers) => {
            assert.ifError(err);
            assert.strictEqual(result.length, 6);
            assert.strictEqual(headers['carto-user-id'], '1');
            done();
        });
    });
});
