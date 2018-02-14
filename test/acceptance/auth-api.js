const assert = require('../support/assert');
const TestClient = require('../support/test-client');
const BatchTestClient = require('../support/batch-test-client');

describe('Auth API', function () {
    const publicSQL = 'select * from untitle_table_4';
    const scopedSQL = 'select * from scoped_table_1';
    const privateSQL = 'select * from private_table';

    it('should get result from query using the default API key', function (done) {
        this.testClient = new TestClient();
        this.testClient.getResult(publicSQL, (err, result) => {
            assert.ifError(err);
            assert.equal(result.length, 6);
            done();
        });
    });

    it('should fail while fetching data (private dataset) and using the default API key', function (done) {
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


    it('should get result from query using the master API key and public dataset', function (done) {
        this.testClient = new TestClient({ apiKey: 1234 });
        this.testClient.getResult(publicSQL, (err, result) => {
            assert.ifError(err);
            assert.equal(result.length, 6);
            done();
        });
    });

    it('should get result from query using the master API key and private dataset', function (done) {
        this.testClient = new TestClient({ apiKey: 1234 });
        this.testClient.getResult(privateSQL, (err, result) => {
            assert.ifError(err);
            assert.equal(result.length, 5);
            done();
        });
    });

    it('should get result from query using the regular API key and scoped dataset', function (done) {
        this.testClient = new TestClient({ apiKey: 'regular1' });
        this.testClient.getResult(scopedSQL, (err, result) => {
            assert.ifError(err);
            assert.equal(result.length, 4);
            done();
        });
    });

    it('should fail while fetching data (scoped dataset) and using the default API key', function (done) {
        this.testClient = new TestClient({ apiKey: 'regular2' });
        const expectedResponse = {
            response: {
                status: 401
            }
        };

        this.testClient.getResult(scopedSQL, expectedResponse, (err, result) => {
            assert.ifError(err);
            assert.equal(result.error, 'permission denied for relation scoped_table_1');
            done();
        });
    });

    it('should fail while creating a job with regular api key', function (done) {
        this.testClient = new BatchTestClient({ apiKey: 'regular1' });
        const expectedResponse = {
            response: {
                status: 401
            }
        };

        this.testClient.createJob({ query: scopedSQL }, expectedResponse, (err, jobResult) => {
            if (err) {
                return done(err);
            }

            assert.deepEqual(jobResult.job.error, [ 'permission denied' ]);
            this.testClient.drain(done);
        });
    });
});
