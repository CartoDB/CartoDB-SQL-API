const assert = require('../support/assert');
const TestClient = require('../support/test-client');
const BatchTestClient = require('../support/batch-test-client');
const JobStatus = require('../../batch/job_status');

describe('Auth API', function () {
    const publicSQL = 'select * from untitle_table_4';
    const scopedSQL = 'select * from scoped_table_1';
    const privateSQL = 'select * from private_table';
    const systemSQL = 'select * from information_schema.tables';

    it('should get result from query using the default API key', function (done) {
        this.testClient = new TestClient();
        this.testClient.getResult(publicSQL, (err, result) => {
            assert.ifError(err);
            assert.equal(result.length, 6);
            done();
        });
    });

    it('should fail when using a wrong API key', function (done) {
        this.testClient = new TestClient({ apiKey: 'THIS_API_KEY_DOES_NOT_EXIST' });

        const expectedResponse = {
            response: {
                status: 401
            }
        };

        this.testClient.getResult(publicSQL, expectedResponse, (err, result) => {
            assert.ifError(err);
            assert.equal(result.error, 'Unauthorized');
            done();
        });
    });

    it('should fail while fetching data (private dataset) and using the default API key', function (done) {
        this.testClient = new TestClient();
        const expectedResponse = {
            response: {
                status: 403
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
                status: 403
            }
        };

        this.testClient.getResult(scopedSQL, expectedResponse, (err, result) => {
            assert.ifError(err);
            assert.equal(result.error, 'permission denied for relation scoped_table_1');
            done();
        });
    });

    describe('Batch API', function () {
        it('should create a job with regular api key and get it done', function (done) {
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

        it('should create a job with regular api key and get it failed', function (done) {
            this.testClient = new BatchTestClient({ apiKey: 'regular1' });

            this.testClient.createJob({ query: privateSQL }, (err, jobResult) => {
                if (err) {
                    return done(err);
                }

                jobResult.getStatus(function (err, job) {
                    if (err) {
                        return done(err);
                    }

                    assert.equal(job.status, JobStatus.FAILED);
                    assert.equal(job.failed_reason, 'permission denied for relation private_table');

                    done();
                });
            });
        });

        afterEach(function (done) {
            this.testClient.drain(done);
        });
    });

    describe('Basic Auth', function () {
        it('should get result from query using the regular API key and scoped dataset', function (done) {
            this.testClient = new TestClient({ authorization: 'vizzuality:regular1' });

            this.testClient.getResult(scopedSQL, { anonymous: true }, (err, result) => {
                assert.ifError(err);
                assert.equal(result.length, 4);
                done();
            });
        });

        it('should fail while fetching data (scoped dataset) and using regular API key', function (done) {
            this.testClient = new TestClient({ authorization: 'vizzuality:regular2' });
            const expectedResponse = {
                response: {
                    status: 403
                },
                anonymous: true
            };

            this.testClient.getResult(scopedSQL, expectedResponse, (err, result) => {
                assert.ifError(err);
                assert.equal(result.error, 'permission denied for relation scoped_table_1');
                done();
            });
        });


        it('should fail while fetching information schema and using default API key', function (done) {
            this.testClient = new TestClient({ authorization: 'vizzuality:default_public' });
            const expectedResponse = {
                response: {
                    status: 403
                },
                anonymous: true
            };

            this.testClient.getResult(systemSQL, expectedResponse, (err, result) => {
                assert.ifError(err);
                assert.equal(result.error, 'system tables are forbidden');
                done();
            });
        });

        it('should fail when basic auth name does not match with user\'s', function (done) {
            this.testClient = new TestClient({ authorization: 'wadus:regular2' });
            const expectedResponse = {
                response: {
                    status: 403
                },
                anonymous: true
            };

            this.testClient.getResult(scopedSQL, expectedResponse, (err, result) => {
                assert.ifError(err);
                assert.equal(result.error, 'permission denied');
                done();
            });
        });

        it('should fail when querying using a wrong API key', function (done) {
            this.testClient = new TestClient({ authorization: 'vizzuality:THIS_API_KEY_DOES_NOT_EXIST' });

            const expectedResponse = {
                response: {
                    status: 401
                },
                anonymous: true
            };

            this.testClient.getResult(publicSQL, expectedResponse, (err, result) => {
                assert.ifError(err);
                assert.equal(result.error, 'Unauthorized');
                done();
            });
        });

        describe('Batch API', function () {
            it('should create a job with regular api key and get it done', function (done) {
                this.testClient = new BatchTestClient({ authorization: 'vizzuality:regular1' });

                this.testClient.createJob({ query: scopedSQL }, { anonymous: true }, (err, jobResult) => {
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

            it('should create a job with regular api key and get it failed', function (done) {
                this.testClient = new BatchTestClient({ authorization: 'vizzuality:regular1' });

                this.testClient.createJob({ query: privateSQL }, { anonymous: true }, (err, jobResult) => {
                    if (err) {
                        return done(err);
                    }

                    jobResult.getStatus(function (err, job) {
                        if (err) {
                            return done(err);
                        }

                        assert.equal(job.status, JobStatus.FAILED);
                        assert.equal(job.failed_reason, 'permission denied for relation private_table');

                        done();
                    });
                });
            });

            afterEach(function (done) {
                this.testClient.drain(done);
            });
        });
    });
});
