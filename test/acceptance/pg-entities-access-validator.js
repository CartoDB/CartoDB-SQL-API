const assert = require('../support/assert');
const TestClient = require('../support/test-client');

describe('PG entities access validator', function () {
    const forbiddenQueries = [
        'select * from information_schema.tables',
        'select * from pg_catalog.pg_auth_members'
    ];

    const testClientEmpty = new TestClient();
    const testClientApiKey = new TestClient({ apiKey: 1234 });
    const testClientAuthorized = new TestClient({ authorization: 'vizzuality:regular1' });

    const expectedResponse = {
        response: {
            status: 403
        },
        anonymous: true
    };

    function assertQuery(query, testClient, done) {
        testClient.getResult(query, expectedResponse, (err, result) => {
            assert.ifError(err);
            assert.equal(result.error, 'system tables are forbidden');
            done();
        });
    }

    describe('validatePGEntitiesAccess enabled', function() {
        before(function(){
            global.validatePGEntitiesAccess = true;            
        });

        forbiddenQueries.forEach(query => {
            it(`testClientEmpty: query: ${query}`, function(done) {
                assertQuery(query, testClientEmpty, done);
            });
    
            it(`testClientApiKey: query: ${query}`, function(done) {
                assertQuery(query, testClientApiKey, done);
            });
    
            it(`testClientAuthorized: query: ${query}`, function(done) {
                assertQuery(query, testClientAuthorized, done);
            });    
        });
    });
    
    describe('validatePGEntitiesAccess disabled', function() {
        before(function(){
            global.validatePGEntitiesAccess = false;            
        });
        
        forbiddenQueries.forEach(query => {
            it(`testClientEmpty: query: ${query}`, function(done) {
                assertQuery(query, testClientEmpty, done);
            });
    
            it(`testClientApiKey: query: ${query}`, function(done) {
                assertQuery(query, testClientApiKey, done);
            });
    
            it(`testClientAuthorized: query: ${query}`, function(done) {
                testClientAuthorized.getResult(query, err => {
                    assert.ifError(err);
                    done();
                });
            });    
        });
    });
});
