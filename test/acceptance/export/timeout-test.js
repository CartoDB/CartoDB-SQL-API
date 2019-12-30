'use strict';

const TestClient = require('../../support/test-client');

require('../../support/assert');

var assert = require('assert');
var querystring = require('querystring');
const dbUtils = require('../../support/db_utils');

describe('timeout', function () {
    describe('export database', function () {
        before(dbUtils.resetPgBouncerConnections);
        after(dbUtils.resetPgBouncerConnections);

        const databaseTimeoutQuery = `
            select
                ST_SetSRID(ST_Point(0, 0), 4326) as the_geom,
                pg_sleep(0.2) as sleep,
                1 as value
        `;

        const scenarios = [
            {
                desc: 'CSV',
                format: 'csv',
                contentType: 'application/x-www-form-urlencoded',
                parser: querystring.stringify,
                // only: true,
                skip: true
            },
            {
                query: databaseTimeoutQuery,
                desc: 'Geopackage',
                format: 'gpkg'
            },
            {
                query: databaseTimeoutQuery,
                desc: 'KML',
                format: 'kml'
            },
            {
                query: databaseTimeoutQuery,
                desc: 'Shapefile',
                format: 'shp'
            },
            {
                query: databaseTimeoutQuery,
                desc: 'Spatialite',
                format: 'spatialite'
            },
            {
                query: databaseTimeoutQuery,
                desc: 'Array Buffer',
                format: 'arraybuffer'
            },
            {
                query: databaseTimeoutQuery,
                desc: 'GeoJSON',
                format: 'geojson'
            },
            {
                query: databaseTimeoutQuery,
                desc: 'JSON',
                format: 'json'
            },
            {
                query: databaseTimeoutQuery,
                desc: 'SVG',
                format: 'svg'
            },
            {
                query: databaseTimeoutQuery,
                desc: 'TopoJSON',
                format: 'topojson'
            }
        ];

        beforeEach(function (done) {
            this.testClient = new TestClient();
            this.testClient.setUserDatabaseTimeoutLimit('localhost', 100, done);
        });

        afterEach(function (done) {
            this.testClient.setUserDatabaseTimeoutLimit('localhost', 2000, done);
        });

        scenarios.forEach((scenario) => {
            const test = scenario.only ? it.only : scenario.skip ? it.skip : it;

            test(`${scenario.desc} export exceeding statement timeout responds 429 Over Limits`, function (done) {
                const override = {
                    'Content-Type': scenario.contentType,
                    parser: scenario.parser,
                    anonymous: true,
                    format: scenario.format,
                    response: {
                        status: 429
                    }
                };

                this.testClient.getResult(scenario.query, override, (err, res) => {
                    assert.ifError(err);

                    assert.deepStrictEqual(res, {
                        error: [
                            'You are over platform\'s limits: SQL query timeout error.' +
                            ' Refactor your query before running again or contact CARTO support for more details.'
                        ],
                        context: 'limit',
                        detail: 'datasource'
                    });

                    done();
                });
            });
        });
    });

    describe('export ogr command timeout', function () {
        const ogrCommandTimeoutQuery = `
            select
                ST_SetSRID(ST_Point(0, 0), 4326) as the_geom,
                pg_sleep(0.2) as sleep,
                1 as value
            `;

        const scenarios = [
            {
                query: ogrCommandTimeoutQuery,
                desc: 'CSV',
                format: 'csv',
                contentType: 'application/x-www-form-urlencoded',
                parser: querystring.stringify
                // only: true,
                // skip: true
            },
            {
                query: ogrCommandTimeoutQuery,
                filename: 'wadus_gpkg_filename',
                desc: 'Geopackage',
                format: 'gpkg'
            },
            {
                query: ogrCommandTimeoutQuery,
                desc: 'KML',
                format: 'kml'
            },
            {
                query: ogrCommandTimeoutQuery,
                desc: 'Shapefile',
                format: 'shp'
            },
            {
                query: ogrCommandTimeoutQuery,
                desc: 'Spatialite',
                format: 'spatialite'
            }
        ];

        beforeEach(function (done) {
            this.testClient = new TestClient();
            this.testClient.setUserRenderTimeoutLimit('vizzuality', 100, done);
        });

        afterEach(function (done) {
            this.testClient.setUserRenderTimeoutLimit('vizzuality', 0, done);
        });

        scenarios.forEach((scenario) => {
            const test = scenario.only ? it.only : scenario.skip ? it.skip : it;

            test(`${scenario.desc} export exceeding statement timeout responds 429 Over Limits`, function (done) {
                const override = {
                    'Content-Type': scenario.contentType,
                    parser: scenario.parser,
                    anonymous: true,
                    format: scenario.format,
                    filename: scenario.filename,
                    response: {
                        status: 429
                    }
                };

                this.testClient.getResult(scenario.query, override, (err, res) => {
                    assert.ifError(err);

                    assert.deepStrictEqual(res, {
                        error: [
                            'You are over platform\'s limits: SQL query timeout error.' +
                            ' Refactor your query before running again or contact CARTO support for more details.'
                        ],
                        context: 'limit',
                        detail: 'datasource'
                    });

                    done();
                });
            });
        });
    });
});
