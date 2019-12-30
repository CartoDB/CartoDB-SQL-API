'use strict';

const assert = require('../support/assert');
const TestClient = require('../support/test-client');

describe('PG entities access validator', function () {
    const forbiddenQueries = [
        'select * from information_schema.tables',
        'select * from pg_catalog.pg_auth_members'
    ];

    const testClientApiKey = new TestClient({ apiKey: 1234 });
    const testClientAuthorized = new TestClient({ authorization: 'vizzuality:regular1' });

    const expectedResponse = {
        response: {
            status: 403
        }
    };

    function assertQuery (query, testClient, done) {
        testClient.getResult(query, expectedResponse, (err, result) => {
            assert.ifError(err);
            assert.deepStrictEqual(result.error, ['system tables are forbidden']);
            done();
        });
    }

    describe('validatePGEntitiesAccess enabled', function () {
        before(function () {
            global.settings.validatePGEntitiesAccess = true;
        });

        forbiddenQueries.forEach(query => {
            it(`testClientApiKey: query: ${query}`, function (done) {
                assertQuery(query, testClientApiKey, done);
            });

            it(`testClientAuthorized: query: ${query}`, function (done) {
                assertQuery(query, testClientAuthorized, done);
            });
        });
    });

    describe('validatePGEntitiesAccess disabled', function () {
        before(function () {
            global.settings.validatePGEntitiesAccess = false;
        });

        forbiddenQueries.forEach(query => {
            it(`testClientApiKey: query: ${query}`, function (done) {
                testClientApiKey.getResult(query, err => {
                    assert.ifError(err);
                    done();
                });
            });

            it(`testClientAuthorized: query: ${query}`, function (done) {
                testClientAuthorized.getResult(query, err => {
                    assert.ifError(err);
                    done();
                });
            });
        });
    });
});
