require('../../helper');
require('../../support/assert');

var fs = require('fs');
let server = require('../../../app/server');
const assert = require('assert');
const querystring = require('querystring');

describe.only('export folder', function() {
    it('folder exists', function(done){
        const currentTmpDir = global.settings.tmpDir;

        global.settings.tmpDir = `/tmp/${new Date().getTime()}/a/b/c`;
        server = server();

        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT 1',
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {}, function(err, res) {
            assert.ifError(err);
            assert.ok(res.statusCode === 200);
            assert.ok(fs.existsSync(global.settings.tmpDir));

            global.settings.tmpDir = currentTmpDir;

            done();
        });
    });
});
