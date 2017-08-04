const TestClient = require('../../support/test-client');

require('../../support/assert');

var assert = require('assert');
var querystring = require('querystring');

describe('export timeout', function () {
    beforeEach(function () {
        this.testClient = new TestClient();
    });

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
            desc: 'Geopackage',
            format: 'gpkg'
        },
        {
            desc: 'KML',
            format: 'kml'
        },
        {
            desc: 'Shapefile',
            format: 'shp'
        },
        {
            desc: 'Spatialite',
            format: 'spatialite'
        },
        {
            desc: 'Array Buffer',
            format: 'arraybuffer'
        },
        {
            desc: 'GeoJSON',
            format: 'geojson'
        },
        {
            desc: 'JSON',
            format: 'json'
        },
        {
            desc: 'SVG',
            format: 'svg'
        },
        {
            desc: 'TopoJSON',
            format: 'topojson'
        }
    ];

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

            const query = 'select ST_SetSRID(ST_Point(0, 0), 4326) as the_geom, pg_sleep(2.1) as sleep, 1 as value';
            this.testClient.getResult(query, override, function (err, res) {
                assert.ifError(err);

                assert.deepEqual(res, {
                    error: [
                        'You are over platform\'s limits. Please contact us to know more details'
                    ]
                });

                done();
            });
        });
    });
});
