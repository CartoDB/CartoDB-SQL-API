require('../helper');

var app = require(global.settings.app_root + '/app/controllers/app')();
var assert = require('../support/assert');
var qs = require('querystring');

describe('last modified header', function() {

    var scenarios = [
        {
            tables: ['untitle_table_4'],
            desc: 'should use last updated time from public table',
            expectedLastModified: 'Wed, 01 Jan 2014 23:31:30 GMT'
        },
        {
            tables: ['private_table'],
            desc: 'should use last updated time from private table',
            expectedLastModified: 'Thu, 01 Jan 2015 23:31:30 GMT'
        },
        {
            tables: ['untitle_table_4', 'private_table'],
            desc: 'should use most recent last updated time from private and public table',
            expectedLastModified: 'Thu, 01 Jan 2015 23:31:30 GMT'
        },
        {
            tables: ['populated_places_simple_reduced', 'private_table'],
            desc: 'should use last updated time from table in cdb_tablemetadata instead of now() from unknown table',
            expectedLastModified: 'Thu, 01 Jan 2015 23:31:30 GMT'
        }
    ];

    scenarios.forEach(function(scenario) {
        it(scenario.desc, function(done) {
            var query = qs.stringify({
                q: scenario.tables.map(function(table) {
                    return 'select cartodb_id from ' + table;
                }).join(' UNION ALL '),
                api_key: 1234
            });
            assert.response(app,
                {
                    url: '/api/v1/sql?' + query,
                    headers: {
                        host: 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                },
                {
                    statusCode: 200
                },
                function(res) {
                    assert.equal(res.headers['last-modified'], scenario.expectedLastModified);
                    done();
                }
            );
        });
    });

    it('should use Date.now() for tables not present in cdb_tablemetadata', function(done) {
        var query = qs.stringify({
            q: 'select cartodb_id from populated_places_simple_reduced limit 1',
            api_key: 1234
        });
        var fixedDateNow = Date.now();
        var dateNowFn = Date.now;
        Date.now = function() {
            return fixedDateNow;
        };
        assert.response(app,
            {
                url: '/api/v1/sql?' + query,
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'GET'
            },
            {
                statusCode: 200
            },
            function(res) {
                Date.now = dateNowFn;
                assert.equal(res.headers['last-modified'], new Date(fixedDateNow).toUTCString());
                done();
            }
        );
    });

    it('should use Date.now() for functions or results with no table associated', function(done) {
        var query = qs.stringify({
            q: 'select 1',
            api_key: 1234
        });
        var fixedDateNow = Date.now();
        var dateNowFn = Date.now;
        Date.now = function() {
            return fixedDateNow;
        };
        assert.response(app,
            {
                url: '/api/v1/sql?' + query,
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'GET'
            },
            {
                statusCode: 200
            },
            function(res) {
                Date.now = dateNowFn;
                assert.equal(res.headers['last-modified'], new Date(fixedDateNow).toUTCString());
                done();
            }
        );
    });

});
