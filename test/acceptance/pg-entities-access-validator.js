const assert = require('../support/assert');
const TestClient = require('../support/test-client');

describe('PG entities access validator', function () {
    const forbiddenQueries = [
        'select * from information_schema.tables',
        'select * from pg_catalog.pg_auth_members'
    ];

    forbiddenQueries.forEach(query => {
        let apiKey = 1234;
        const expectedResponse = {
            response: {
                status: 403
            },
            anonymous: true
        };

        it(`query: ${query}`, function(done) {
            this.testClient = new TestClient({ apiKey });
            this.testClient.getResult(query, expectedResponse, (err, result) => {
                assert.ifError(err);
                assert.equal(result.error, 'system tables are forbidden');                
                done();
            });
        });
    });

});