'use strict';

require('../helper');

const server = require('../../lib/server')();
const assert = require('../support/assert');
const querystring = require('querystring');

const okResponse = {
    status: 200
};

describe('PG field type information', function () {
    it('should return type info while requesting json format', function (done) {
        assert.response(
            server,
            {
                url: `/api/v1/sql?${querystring.stringify({ q: 'select * from pgtypes_table' })}`,
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            },
            okResponse,
            function (err, res) {
                assert.ifError(err);
                const body = JSON.parse(res.body);

                assert.deepStrictEqual(body.fields, {
                    geography_point_4326: {
                        type: 'geography', wkbtype: 'Point', dims: 2, srid: 4326
                    },
                    geometry_point_4326: {
                        type: 'geometry', wkbtype: 'Point', dims: 2, srid: 4326
                    },
                    geometry_point_3857: {
                        type: 'geometry', wkbtype: 'Point', dims: 2, srid: 3857
                    },
                    geometry_pointz_4326: {
                        type: 'geometry', wkbtype: 'Point', dims: 3, srid: 4326
                    },
                    geometry_pointzm_4326: {
                        type: 'geometry', wkbtype: 'Point', dims: 4, srid: 4326
                    },
                    geography_line_4326: {
                        type: 'geography', wkbtype: 'LineString', dims: 2, srid: 4326
                    },
                    geometry_line_4326: {
                        type: 'geometry', wkbtype: 'LineString', dims: 2, srid: 4326
                    },
                    geometry_line_3857: {
                        type: 'geometry', wkbtype: 'LineString', dims: 2, srid: 3857
                    },
                    geometry_linez_4326: {
                        type: 'geometry', wkbtype: 'LineString', dims: 3, srid: 4326
                    },
                    geometry_linezm_4326: {
                        type: 'geometry', wkbtype: 'LineString', dims: 4, srid: 4326
                    },
                    geography_polygon_4326: {
                        type: 'geography', wkbtype: 'Polygon', dims: 2, srid: 4326
                    },
                    geometry_polygon_4326: {
                        type: 'geometry', wkbtype: 'Polygon', dims: 2, srid: 4326
                    },
                    geometry_polygon_3857: {
                        type: 'geometry', wkbtype: 'Polygon', dims: 2, srid: 3857
                    },
                    geometry_polygonz_4326: {
                        type: 'geometry', wkbtype: 'Polygon', dims: 3, srid: 4326
                    },
                    geometry_polygonzm_4326: {
                        type: 'geometry', wkbtype: 'Polygon', dims: 4, srid: 4326
                    },
                    geography_multipoint_4326: {
                        type: 'geography', wkbtype: 'MultiPoint', dims: 2, srid: 4326
                    },
                    geometry_multipoint_4326: {
                        type: 'geometry', wkbtype: 'MultiPoint', dims: 2, srid: 4326
                    },
                    geometry_multipoint_3857: {
                        type: 'geometry', wkbtype: 'MultiPoint', dims: 2, srid: 3857
                    },
                    geometry_multipointz_4326: {
                        type: 'geometry', wkbtype: 'MultiPoint', dims: 3, srid: 4326
                    },
                    geometry_multipointzm_4326: {
                        type: 'geometry', wkbtype: 'MultiPoint', dims: 4, srid: 4326
                    },
                    geography_multilinestring_4326: {
                        type: 'geography', wkbtype: 'MultiLineString', dims: 2, srid: 4326
                    },
                    geometry_multilinestring_4326: {
                        type: 'geometry', wkbtype: 'MultiLineString', dims: 2, srid: 4326
                    },
                    geometry_multilinestring_3857: {
                        type: 'geometry', wkbtype: 'MultiLineString', dims: 2, srid: 3857
                    },
                    geometry_multilinestringz_4326: {
                        type: 'geometry', wkbtype: 'MultiLineString', dims: 3, srid: 4326
                    },
                    geometry_multilinestringzm_4326: {
                        type: 'geometry', wkbtype: 'MultiLineString', dims: 4, srid: 4326
                    },
                    geography_multipolygon_4326: {
                        type: 'geography', wkbtype: 'MultiPolygon', dims: 2, srid: 4326
                    },
                    geometry_multipolygon_4326: {
                        type: 'geometry', wkbtype: 'MultiPolygon', dims: 2, srid: 4326
                    },
                    geometry_multipolygon_3857: {
                        type: 'geometry', wkbtype: 'MultiPolygon', dims: 2, srid: 3857
                    },
                    geometry_multipolygonz_4326: {
                        type: 'geometry', wkbtype: 'MultiPolygon', dims: 3, srid: 4326
                    },
                    geometry_multipolygonzm_4326: {
                        type: 'geometry', wkbtype: 'MultiPolygon', dims: 4, srid: 4326
                    },
                    raster: {
                        type: 'raster', dims: 4, srid: -1
                    },
                    boolean: {
                        type: 'boolean', pgtype: 'bool'
                    },
                    smallint: {
                        type: 'number', pgtype: 'int2'
                    },
                    integer: {
                        type: 'number', pgtype: 'int4'
                    },
                    bigint: {
                        type: 'number', pgtype: 'int8'
                    },
                    float: {
                        type: 'number', pgtype: 'float8'
                    },
                    real: {
                        type: 'number', pgtype: 'float4'
                    },
                    varchar: {
                        type: 'string', pgtype: 'varchar'
                    },
                    text: {
                        type: 'string', pgtype: 'text'
                    },
                    time: {
                        type: 'date', pgtype: 'time'
                    },
                    date: {
                        type: 'date', pgtype: 'date'
                    },
                    timestamp: {
                        type: 'date', pgtype: 'timestamp'
                    },
                    timestamptz: {
                        type: 'date', pgtype: 'timestamptz'
                    },
                    money: {
                        type: 'money', pgtype: 'money'
                    }
                });

                done();
            }
        );
    });
});
