require('../helper');

var qs = require('querystring');

var app = require(global.settings.app_root + '/app/app')();
var assert = require('../support/assert');

var QueryTablesApi = require('../../app/services/query-tables-api');

describe('query-tables-api', function() {

    var scenarios = [
        {
            apiKey: 1234,
            shouldSkipCache: true
        },
        {
            apiKey: null,
            shouldSkipCache: false
        }
    ];

    scenarios.forEach(function(scenario) {
        var shouldOrShouldNot = scenario.shouldSkipCache ? 'should' : 'should NOT';
        var desc = 'authenticated=' + JSON.stringify(!!scenario.apiKey) + ' requests' +
            ' ' + shouldOrShouldNot + ' skip internal query-tables-api cache';
        it(desc, function(done) {
            var getAffectedTablesCalled = false;
            var skippedCache = null;
            var getAffectedTablesFn = QueryTablesApi.prototype.getAffectedTablesAndLastUpdatedTime;
            QueryTablesApi.prototype.getAffectedTablesAndLastUpdatedTime =
                function(connectionParams, sql, skipCache, callback) {
                    getAffectedTablesCalled = true;
                    skippedCache = skipCache;
                    return callback(null, {
                        affectedTables: [],
                        lastModified: Date.now(),
                        mayWrite: false,
                        hits: 1
                    });
                };
            assert.response(
                app,
                {
                    url: '/api/v1/sql?' + qs.stringify({
                        api_key: scenario.apiKey,
                        q: 'SELECT * FROM untitle_table_4'
                    }),
                    headers: {
                        host: 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                },
                {
                    // status: 200 // not using this as we cannot restore getAffectedTablesAndLastUpdatedTime
                },
                function(res, err) {
                    QueryTablesApi.prototype.getAffectedTablesAndLastUpdatedTime = getAffectedTablesFn;

                    assert.ok(!err, err);
                    assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);

                    assert.equal(skippedCache, scenario.shouldSkipCache, 'skip cache expected as true');
                    assert.ok(getAffectedTablesCalled, 'getAffectedTablesAndLastUpdatedTime NOT called');

                    done();
                }
            );
        });
    });
});
