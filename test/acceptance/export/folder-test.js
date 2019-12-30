'use strict';

require('../../helper');
require('../../support/assert');

const fs = require('fs');
let server = require('../../../lib/server');
const assert = require('assert');
const querystring = require('querystring');

describe('export folder', function () {
    it('folder exists', function (done) {
        const currentTmpDir = global.settings.tmpDir;

        const dynamicTmpDir = `/tmp/${new Date().getTime()}/a/b/c`;
        global.settings.tmpDir = dynamicTmpDir;
        server = server();

        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT 1'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {}, function (err, res) {
            assert.ifError(err);
            assert.ok(res.statusCode === 200);
            assert.ok(fs.existsSync(dynamicTmpDir));

            global.settings.tmpDir = currentTmpDir;

            done();
        });
    });
});
