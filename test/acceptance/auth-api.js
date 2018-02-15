const assert = require('../support/assert');
const TestClient = require('../support/test-client');
const BatchTestClient = require('../support/batch-test-client');
const JobStatus = require('../../batch/job_status');

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


    // TODO: this is obviously a really dangerous sceneario, but in order to not break
    // some uses cases (i.e: ) and keep backwards compatiblity we will keep it during some time.
    // It should be fixed as soon as possible
    it('should get result from query using a wrong API key', function (done) {
        this.testClient = new TestClient({ apiKey: 'wrong' });

        this.testClient.getResult(publicSQL, (err, result) => {
            assert.ifError(err);
            assert.equal(result.length, 6);
            done();
        });
    });

    // TODO: this is obviously a really dangerous sceneario, but in order to not break
    // some uses cases (i.e: ) and keep backwards compatiblity we will keep it during some time.
    // It should be fixed as soon as possible
    it('should fail while fetching data (private dataset) and using a wrong API key', function (done) {
        this.testClient = new TestClient({ apiKey: 'wrong' });
        const expectedResponse = {
            response: {
                status: 401
            }
        };

        this.testClient.getResult(privateSQL, expectedResponse, (err, result) => {
            assert.ifError(err);
            assert.equal(result.error, 'permission denied for relation private_table');
            done();
        });
    });

    it('should fail while fetching data (private dataset) and using the default API key', function (done) {
        this.testClient = new TestClient();
        const expectedResponse = {
            response: {
                status: 401
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

    it('should fail while fetching data (scoped dataset) and using regular API key', function (done) {
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

    describe('Fallback', function () {
        it('should get result from query using master apikey (fallback) and a granted dataset', function (done) {
            this.testClient = new TestClient({ apiKey: '4321', host: 'cartofante.cartodb.com' });
            this.testClient.getResult(scopedSQL, (err, result) => {
                assert.ifError(err);
                assert.equal(result.length, 4);
                done();
            });
        });

        it('should fail while getting result from query using metadata and scoped dataset', function (done) {
            this.testClient = new TestClient({ host: 'cartofante.cartodb.com' });

            const expectedResponse = {
                response: {
                    status: 401
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

    describe('Batch API', function () {
        it('should create while creating a job with regular api key', function (done) {
            this.testClient = new BatchTestClient({ apiKey: 'regular1' });

            this.testClient.createJob({ query: scopedSQL }, (err, jobResult) => {
                if (err) {
                    return done(err);
                }

                jobResult.getStatus(function (err, job) {
                    if (err) {
                        return done(err);
                    }

                    assert.equal(job.status, JobStatus.DONE);

                    done();
                });
            });
        });

        afterEach(function (done) {
            this.testClient.drain(done);
        });
    });
});
