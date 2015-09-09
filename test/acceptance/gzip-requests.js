require('../helper');

var app = require(global.settings.app_root + '/app/controllers/app')();
var assert = require('../support/assert');
var zlib = require('zlib');

describe('stream-responses', function() {

    var RESPONSE_OK = {
        status: 200
    };

    /* This is equivalent to the following curl call:

    curl "${ENDPOINT}" \
        -H 'Content-Encoding: gzip' \
        -H 'Content-Type: application/x-www-form-urlencoded' \
        --data-binary @<(echo -n "q=SELECT * FROM untitle_table_4 limit 2" | gzip)

    */
    function gzipContentEncodingRequest(gzippedBody) {
        return {
            method: 'POST',
            url: '/api/v1/sql',
            headers: {
                Host: 'vizzuality.cartodb.com',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Encoding': 'gzip'
            },
            data: gzippedBody
        };
    }

    it('should ungzip requests with "Content-Encoding: gzip" header', function(done) {
        zlib.gzip('q=SELECT * FROM untitle_table_4 limit 2', function(err, gzippedBody) {
            if (err) {
                return done(err);
            }

            assert.response(app, gzipContentEncodingRequest(gzippedBody), RESPONSE_OK, function(res) {
                var parsedBody = JSON.parse(res.body);
                assert.equal(parsedBody.rows.length, 2);
                done();
            });
        });
    });

});
