'use strict';

require('../../helper');

var server = require('../../../lib/server')();
var assert = require('../../support/assert');
var querystring = require('querystring');
var _ = require('underscore');

describe('export.topojson', function () {
// TOPOJSON tests

    function getRequest (query, extraParams) {
        var params = {
            q: query,
            format: 'topojson'
        };

        params = _.extend(params, extraParams || {});

        return {
            url: '/api/v1/sql?' + querystring.stringify(params),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        };
    }

    it('GET two polygons sharing an edge as topojson', function (done) {
        assert.response(server,
            getRequest(
                "SELECT 1 as gid, 'U' as name, 'POLYGON((-5 0,5 0,0 5,-5 0))'::geometry as the_geom " +
            ' UNION ALL ' +
            "SELECT 2, 'D', 'POLYGON((0 -5,0 5,-5 0,0 -5))'::geometry as the_geom "
            ),
            {
                status: 200
            },
            function (err, res) {
                assert.ifError(err);
                var cd = res.headers['content-disposition'];
                assert.strictEqual(true, /^attachment/.test(cd), 'TOPOJSON is not disposed as attachment: ' + cd);
                assert.strictEqual(true, /filename=cartodb-query.topojson/gi.test(cd));
                var topojson = JSON.parse(res.body);
                assert.strictEqual(topojson.type, 'Topology');

                // Check transform
                assert.ok(Object.prototype.hasOwnProperty.call(topojson, 'transform'));
                var trans = topojson.transform;
                assert.strictEqual(_.keys(trans).length, 2); // only scale and translate
                assert.strictEqual(trans.scale.length, 2); // scalex, scaley
                assert.strictEqual(Math.round(trans.scale[0] * 1e6), 1000);
                assert.strictEqual(Math.round(trans.scale[1] * 1e6), 1000);
                assert.strictEqual(trans.translate.length, 2); // translatex, translatey
                assert.strictEqual(trans.translate[0], -5);
                assert.strictEqual(trans.translate[1], -5);

                // Check objects
                assert.ok(Object.prototype.hasOwnProperty.call(topojson, 'objects'));
                assert.strictEqual(_.keys(topojson.objects).length, 2);

                var obj = topojson.objects[0];
                // console.dir(obj);
                // Expected:
                // { type: 'Polygon',
                //   arcs: [ [ 0, 1 ] ],
                //   properties: { gid: 1, nam: 'U' } }
                assert.strictEqual(_.keys(obj).length, 3); // type, arcs, properties
                assert.strictEqual(obj.type, 'Polygon');
                assert.strictEqual(obj.arcs.length, 1); /* only shell, no holes */
                var shell = obj.arcs[0];
                assert.strictEqual(shell.length, 2); /* one shared arc, one non-shared */
                assert.strictEqual(shell[0], 0); /* shared arc */
                assert.strictEqual(shell[1], 1); /* non-shared arc */
                var props = obj.properties;
                assert.strictEqual(_.keys(props).length, 2); // gid, name
                assert.strictEqual(props.gid, 1);
                assert.strictEqual(props.name, 'U');

                obj = topojson.objects[1];
                // console.dir(obj);
                // Expected:
                // { type: 'Polygon',
                //   arcs: [ [ 0, 2 ] ],
                //   properties: { gid: 2, nam: 'D' } }
                assert.strictEqual(_.keys(obj).length, 3); // type, arcs, properties
                assert.strictEqual(obj.type, 'Polygon');
                assert.strictEqual(obj.arcs.length, 1); /* only shell, no holes */
                shell = obj.arcs[0];
                assert.strictEqual(shell.length, 2); /* one shared arc, one non-shared */
                assert.strictEqual(shell[0], 0); /* shared arc */
                assert.strictEqual(shell[1], 2); /* non-shared arc */
                props = obj.properties;
                assert.strictEqual(_.keys(props).length, 2); // gid, name
                assert.strictEqual(props.gid, 2);
                assert.strictEqual(props.name, 'D');

                // Check arcs
                assert.ok(Object.prototype.hasOwnProperty.call(topojson, 'arcs'));
                assert.strictEqual(topojson.arcs.length, 3); // one shared, two non-shared
                var arc = topojson.arcs[0]; // shared arc
                assert.strictEqual(arc.length, 2); // shared arc has two vertices
                var p = arc[0];
                assert.strictEqual(Math.round(p[0] * trans.scale[0]), 0);
                assert.strictEqual(Math.round(p[1] * trans.scale[1]), 5);
                p = arc[1];
                assert.strictEqual(Math.round(p[0] * trans.scale[0]), 5);
                assert.strictEqual(Math.round(p[1] * trans.scale[1]), 5);
                arc = topojson.arcs[1]; // non shared arc
                assert.strictEqual(arc.length, 3); // non shared arcs have three vertices
                p = arc[0];
                assert.strictEqual(Math.round(p[0] * trans.scale[0]), 5);
                assert.strictEqual(Math.round(p[1] * trans.scale[1]), 10);
                p = arc[1];
                assert.strictEqual(Math.round(p[0] * trans.scale[0]), 5);
                assert.strictEqual(Math.round(p[1] * trans.scale[1]), -5);
                p = arc[2];
                assert.strictEqual(Math.round(p[0] * trans.scale[0]), -10);
                assert.strictEqual(Math.round(p[1] * trans.scale[1]), 0);
                arc = topojson.arcs[2]; // non shared arc
                assert.strictEqual(arc.length, 3); // non shared arcs have three vertices
                p = arc[0];
                assert.strictEqual(Math.round(p[0] * trans.scale[0]), 5);
                assert.strictEqual(Math.round(p[1] * trans.scale[1]), 10);
                p = arc[1];
                assert.strictEqual(Math.round(p[0] * trans.scale[0]), 0);
                assert.strictEqual(Math.round(p[1] * trans.scale[1]), -10);
                p = arc[2];
                assert.strictEqual(Math.round(p[0] * trans.scale[0]), -5);
                assert.strictEqual(Math.round(p[1] * trans.scale[1]), 5);

                done();
            });
    });

    it('null geometries', function (done) {
        assert.response(server, getRequest(
            "SELECT 1 as gid, 'U' as name, 'POLYGON((-5 0,5 0,0 5,-5 0))'::geometry as the_geom " +
            ' UNION ALL ' +
            "SELECT 2, 'D', null::geometry as the_geom "
        ),
        {
            status: 200
        },
        function (err, res) {
            assert.ifError(err);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'TOPOJSON is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.topojson/gi.test(cd));
            var topojson = JSON.parse(res.body);
            assert.strictEqual(topojson.type, 'Topology');

            // Check transform
            assert.ok(Object.prototype.hasOwnProperty.call(topojson, 'transform'));
            var trans = topojson.transform;
            assert.strictEqual(_.keys(trans).length, 2); // only scale and translate
            assert.strictEqual(trans.scale.length, 2); // scalex, scaley
            assert.strictEqual(Math.round(trans.scale[0] * 1e6), 1000);
            assert.strictEqual(Math.round(trans.scale[1] * 1e6), 500);
            assert.strictEqual(trans.translate.length, 2); // translatex, translatey
            assert.strictEqual(trans.translate[0], -5);
            assert.strictEqual(trans.translate[1], 0);

            // Check objects
            assert.ok(Object.prototype.hasOwnProperty.call(topojson, 'objects'));
            assert.strictEqual(_.keys(topojson.objects).length, 1);

            var obj = topojson.objects[0];
            // console.dir(obj);
            // Expected:
            // { type: 'Polygon',
            //   arcs: [ [ 0, 1 ] ],
            //   properties: { gid: 1, nam: 'U' } }
            assert.strictEqual(_.keys(obj).length, 3); // type, arcs, properties
            assert.strictEqual(obj.type, 'Polygon');
            assert.strictEqual(obj.arcs.length, 1); /* only shell, no holes */
            var shell = obj.arcs[0];
            assert.strictEqual(shell.length, 1); /* one non shared arc */
            assert.strictEqual(shell[0], 0); /* non-shared arc */
            var props = obj.properties;
            assert.strictEqual(_.keys(props).length, 2); // gid, name
            assert.strictEqual(props.gid, 1);
            assert.strictEqual(props.name, 'U');

            // Check arcs
            assert.ok(Object.prototype.hasOwnProperty.call(topojson, 'arcs'));
            assert.strictEqual(topojson.arcs.length, 1);
            var arc = topojson.arcs[0];
            assert.deepStrictEqual(arc, [[0, 0], [4999, 9999], [5000, -9999], [-9999, 0]]);

            done();
        });
    });

    it('skipped fields are not returned', function (done) {
        assert.response(server,
            getRequest(
                "SELECT 1 as gid, 'U' as name, 'POLYGON((-5 0,5 0,0 5,-5 0))'::geometry as the_geom",
                {
                    skipfields: 'name'
                }
            ),
            {
                status: 200
            },
            function (err, res) {
                assert.ifError(err);
                var parsedBody = JSON.parse(res.body);
                assert.strictEqual(parsedBody.objects[0].properties.gid, 1, 'gid was expected property');
                assert.ok(!parsedBody.objects[0].properties.name);
                done();
            }
        );
    });

    it('jsonp callback is invoked', function (done) {
        assert.response(
            server,
            getRequest(
                "SELECT 1 as gid, 'U' as name, 'POLYGON((-5 0,5 0,0 5,-5 0))'::geometry as the_geom",
                {
                    callback: 'fooJsonp'
                }
            ),
            {
                status: 200
            },
            function (err, res) {
                assert.ifError(err);
                assert.strictEqual(res.statusCode, 200, res.statusCode + ': ' + res.body);
                var didRunJsonCallback = false;
                /* eslint-disable */
                function fooJsonp (body) {
                    didRunJsonCallback = true;
                }
                eval(res.body);
                /* eslint-enable */
                assert.ok(didRunJsonCallback);
                done();
            }
        );
    });

    it('should close on error and error must be the only key in the body', function (done) {
        assert.response(
            server,
            {
                url: '/api/v1/sql?' + querystring.stringify({
                    q: 'SELECT the_geom, 100/(cartodb_id - 3) cdb_ratio FROM untitle_table_4',
                    format: 'topojson'
                }),
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'GET'
            },
            {
                status: 400
            },
            function (err, res) {
                assert.ifError(err);
                var parsedBody = JSON.parse(res.body);
                assert.deepStrictEqual(Object.keys(parsedBody), ['error']);
                assert.deepStrictEqual(parsedBody.error, ['division by zero']);
                done();
            }
        );
    });
});
