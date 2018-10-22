require('../../helper');

const server = require('../../../app/server')();
const assert = require('../../support/assert');
const querystring = require('querystring');

describe('Read restriction on "geometry_columns"', function() {
    describe('OGR formats', function () {
        it('GET /api/v1/sql downloads KML file from a private table', function (done){
            const query = querystring.stringify({
                api_key: 1234,
                q: "SELECT * FROM private_table  LIMIT 1",
                format: "kml",
                filename: 'private_table'
            });
            assert.response(server, {
                url: '/api/v1/sql?' + query,
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            },{ }, function(err, res){
                assert.equal(res.statusCode, 200, res.body);

                const cd = res.headers['content-disposition'];

                assert.ok(/filename=private_table.kml/gi.test(cd), cd);
                assert.equal(res.headers['content-type'], 'application/kml; charset=utf-8');

                done();
            });
        });

        it('GET /api/v1/sql downloads a KML file from a public table', function (done){
            const query = querystring.stringify({
                q: "SELECT * FROM populated_places_simple_reduced LIMIT 1",
                format: "kml",
                filename: 'populated_places_simple_reduced'
            });
            assert.response(server, {
                url: '/api/v1/sql?' + query,
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            },{ }, function(err, res){
                assert.equal(res.statusCode, 200, res.body);

                const cd = res.headers['content-disposition'];

                assert.ok(/filename=populated_places_simple_reduced.kml/gi.test(cd), cd);
                assert.equal(res.headers['content-type'], 'application/kml; charset=utf-8');

                done();
            });
        });

        it('GET /api/v1/sql downloads a KML file from "geometry_columns" view', function (done){
            const query = querystring.stringify({
                q: "SELECT * FROM geometry_columns LIMIT 1",
                format: "kml",
                filename: 'geometry_columns'
            });

            assert.response(server, {
                url: '/api/v1/sql?' + query,
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            },{ }, function(err, res){
                assert.equal(res.statusCode, 200, res.body);

                const cd = res.headers['content-disposition'];

                assert.ok(/filename=geometry_columns.kml/gi.test(cd), cd);
                assert.equal(res.headers['content-type'], 'application/kml; charset=utf-8');

                done();
            });
        });

        it('GET /api/v1/sql downloads a KML file with master api_key from "geometry_columns" view', function (done){
            const query = querystring.stringify({
                api_key: 1234,
                q: "SELECT * FROM geometry_columns LIMIT 1",
                format: "kml",
                filename: 'geometry_columns'
            });

            assert.response(server, {
                url: '/api/v1/sql?' + query,
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            },{ }, function(err, res){
                assert.equal(res.statusCode, 200, res.body);

                const cd = res.headers['content-disposition'];

                assert.ok(/filename=geometry_columns.kml/gi.test(cd), cd);
                assert.equal(res.headers['content-type'], 'application/kml; charset=utf-8');

                done();
            });
        });
    });
});
