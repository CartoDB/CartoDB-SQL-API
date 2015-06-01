var app = require(global.settings.app_root + '/app/controllers/app')();
var assert = require('../../support/assert');
var sqlite = require('sqlite3');

describe.only('spatialite query',function(){
    var serverResponse;

    before(function(done){
        assert.response(app, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=spatialite',
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        },{ }, function(res) {
            serverResponse = res;
            done();
        });
    });
    it('returns a valid sqlite database', function(done){
        assert.equal(serverResponse.statusCode, 200, serverResponse.body);
        var db = new sqlite.Database(serverResponse.body);
        var qr = db.get("PRAGMA database_list", function(err, result){
            assert.equal(err, null);
            done();
        });
        assert.notEqual(qr, undefined);
    });
});
