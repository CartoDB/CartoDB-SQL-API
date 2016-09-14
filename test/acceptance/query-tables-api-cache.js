require('../helper');

var qs = require('querystring');

var server = require('../../app/server')();
var assert = require('../support/assert');

describe('query-tables-api', function() {

    function getCacheStatus(callback) {
        assert.response(
            server,
            {
                method: 'GET',
                url: '/api/v1/cachestatus'
            },
            {
                status: 200
            },
            function(res) {
                callback(null, JSON.parse(res.body));
            }
        );
    }

    var request = {
        url: '/api/v1/sql?' + qs.stringify({
            q: 'SELECT * FROM untitle_table_4'
        }),
        headers: {
            host: 'vizzuality.cartodb.com'
        },
        method: 'GET'
    };

    var RESPONSE_OK = {
        status: 200
    };

    it('should create a key in affected tables cache', function(done) {
        assert.response(server, request, RESPONSE_OK, function(res, err) {
            assert.ok(!err, err);

            getCacheStatus(function(err, cacheStatus) {
                assert.ok(!err, err);
                assert.equal(cacheStatus.explain.keys, 1);
                assert.equal(cacheStatus.explain.hits, 0);

                done();
            });
        });
    });

    it('should use cache to retrieve affected tables', function(done) {
        assert.response(server, request, RESPONSE_OK, function(res, err) {
            assert.ok(!err, err);

            getCacheStatus(function(err, cacheStatus) {
                assert.ok(!err, err);
                assert.equal(cacheStatus.explain.keys, 1);
                assert.equal(cacheStatus.explain.hits, 1);

                done();
            });
        });
    });

    it('should skip cache to retrieve affected tables', function(done) {
        var authenticatedRequest = {
            url: '/api/v1/sql?' + qs.stringify({
                q: 'SELECT * FROM untitle_table_4',
                api_key: '1234'
            }),
            headers: {
                host: 'vizzuality.cartodb.com'
            },
            method: 'GET'
        };
        assert.response(server, authenticatedRequest, RESPONSE_OK, function(res, err) {
            assert.ok(!err, err);

            getCacheStatus(function(err, cacheStatus) {
                assert.ok(!err, err);
                assert.equal(cacheStatus.explain.keys, 1);
                assert.equal(cacheStatus.explain.hits, 0);

                done();
            });
        });
    });
});
