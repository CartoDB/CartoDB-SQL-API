const assert = require('../support/assert');
const TestClient = require('../support/test-client');

describe('Auth API', function () {
    const publicSQL = 'select * from untitle_table_4';
    const privateSQL = 'select * from private_table';

    it('should get result from query using the default API key', function (done) {
        this.testClient = new TestClient();
        this.testClient.getResult(publicSQL, (err, result) => {
            assert.ifError(err);
            assert.equal(result.length, 6);
            done();
        });
    });

    it('should fail while creating a map (private dataset) and using the default API key', function (done) {
        this.testClient = new TestClient();
        const expectedResponse = {
            response: {
                response: 401
            },
            anonymous: true
        };
        this.testClient.getResult(privateSQL, expectedResponse, (err, result) => {
            assert.ifError(err);
            assert.equal(result.error, 'permission denied for relation private_table');
            done();
        });
    });
});
