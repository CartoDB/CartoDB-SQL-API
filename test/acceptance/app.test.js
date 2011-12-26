/**
 *
 * Requires the database and tables setup in config/environments/test.js to exist
 * Ensure the user is present in the pgbouncer auth file too
 * TODO: Add OAuth tests.
 *
 * To run this test, ensure that cartodb_test_user_1_db metadata exists in Redis for the vizziality.cartodb.com domain
 *
 * SELECT 5
 * HSET rails:users:vizzuality id 1
 * HSET rails:users:vizzuality database_name cartodb_dev_user_1_db
 *
 */
require('../helper');

var app    = require(global.settings.app_root + '/app/controllers/app')
    , assert = require('assert')
    , tests  = module.exports = {}
    , querystring = require('querystring');


tests['GET /api/v1/sql'] = function(){
    assert.response(app, {
        url: '/api/v1/sql',
        method: 'GET'
    },{
        body: '{"error":["You must indicate a sql query"]}',
        status: 400
    });
};


tests['GET /api/v1/sql with SQL parameter on SELECT only. No oAuth included '] = function(){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db',
        method: 'GET'
    },{
        status: 200
    });
};


tests['GET /api/v1/sql with SQL parameter on SELECT only. no database param, just id using headers'] = function(){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 200
    });
};



tests['POST /api/v1/sql with SQL parameter on SELECT only. no database param, just id using headers'] = function(){
    assert.response(app, {
        url: '/api/v1/sql',
        data: querystring.stringify({q: "SELECT * FROM untitle_table_4"}),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{
        status: 200
    });
};

tests['GET /api/v1/sql with SQL parameter on INSERT only. oAuth not used, so public user - should fail'] = function(){
    assert.response(app, {
        url: "/api/v1/sql?q=INSERT%20INTO%20untitle_table_4%20(id)%20VALUES%20(1)&database=cartodb_dev_user_1_db",
        method: 'GET'
    },{
        status: 400
    });
};

tests['GET /api/v1/sql with SQL parameter on DROP DATABASE only. oAuth not used, so public user - should fail'] = function(){
    assert.response(app, {
        url: "/api/v1/sql?q=DROP%20TABLE%20untitle_table_4&database=cartodb_dev_user_1_db",
        method: 'GET'
    },{
        status: 400
    });
};

tests['GET /api/v1/sql with SQL parameter on INSERT only. header based db - should fail'] = function(){
    assert.response(app, {
        url: "/api/v1/sql?q=INSERT%20INTO%20untitle_table_4%20(id)%20VALUES%20(1)",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 400
    });
};

tests['GET /api/v1/sql with SQL parameter on DROP DATABASE only.header based db - should fail'] = function(){
    assert.response(app, {
        url: "/api/v1/sql?q=DROP%20TABLE%20untitle_table_4",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 400
    });
};

tests['GET /api/v1/sql with SQL parameter and geojson format, ensuring content-disposition set to geojson'] = function(){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 200
    }, function(res){
        var cd = res.header('Content-Disposition');
        assert.equal(true, /filename=cartodb-query.geojson/gi.test(cd));
    });
};

tests['GET /api/v1/sql with SQL parameter and no format, ensuring content-disposition set to json'] = function(){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 200
    }, function(res){
        var cd = res.header('Content-Disposition');
        assert.equal(true, /filename=cartodb-query.json/gi.test(cd));
    });
};

tests['GET /api/v1/sql as geojson limiting decimal places'] = function(){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson&dp=1',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 200
    }, function(res){
        var result = JSON.parse(res.body);
        assert.equal(1, checkDecimals(result.features[0].geometry.coordinates[0], '.'));
    });
};

tests['GET system tables'] = function(){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20pg_attribute',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 403
    });
};

// use dec_sep for internationalization
function checkDecimals(x, dec_sep){
    tmp='' + x;
    if (tmp.indexOf(dec_sep)>-1)
        return tmp.length-tmp.indexOf(dec_sep)-1;
    else
        return 0;
}
