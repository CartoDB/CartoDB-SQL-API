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
    , tests  = module.exports = {};

var real_oauth_header = 'OAuth realm="http://vizzuality.testhost.lan/",oauth_consumer_key="fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2",oauth_token="l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR",oauth_signature_method="HMAC-SHA1", oauth_signature="o4hx4hWP6KtLyFwggnYB4yPK8xI%3D",oauth_timestamp="1313581372",oauth_nonce="W0zUmvyC4eVL8cBd4YwlH1nnPTbxW0QBYcWkXTwe4",oauth_version="1.0"';

tests['GET /api/v1/'] = function(){
    assert.response(app, {
        url: '/api/v1/',
        method: 'GET'
    },{
        body: '{"error":["You must indicate a sql query"]}',
        status: 400
    });
};

tests['GET /api/v1/ with SQL parameter on SELECT only. No oAuth included '] = function(){
    assert.response(app, {
        url: '/api/v1/?sql=SELECT%20*%20FROM%20untitle_table_4&database=cartodb_dev_user_1_db',
        method: 'GET'
    },{
        status: 200
    });
};

tests['GET /api/v1/ with SQL parameter on SELECT only. no database param, just id using headers'] = function(){
    assert.response(app, {
        url: '/api/v1/?sql=SELECT%20*%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 200
    });
};

tests['GET /api/v1/ with SQL parameter on INSERT only. oAuth not used, so public user - should fail'] = function(){
    assert.response(app, {
        url: "/api/v1/?sql=INSERT%20INTO%20untitle_table_4%20(id)%20VALUES%20(1)&database=cartodb_dev_user_1_db",
        method: 'GET'
    },{
        status: 400
    });
};

tests['GET /api/v1/ with SQL parameter on DROP DATABASE only. oAuth not used, so public user - should fail'] = function(){
    assert.response(app, {
        url: "/api/v1/?sql=DROP%20TABLE%20untitle_table_4&database=cartodb_dev_user_1_db",
        method: 'GET'
    },{
        status: 400
    });
};

tests['GET /api/v1/ with SQL parameter on INSERT only. header based db - should fail'] = function(){
    assert.response(app, {
        url: "/api/v1/?sql=INSERT%20INTO%20untitle_table_4%20(id)%20VALUES%20(1)",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 400
    });
};

tests['GET /api/v1/ with SQL parameter on DROP DATABASE only.header based db - should fail'] = function(){
    assert.response(app, {
        url: "/api/v1/?sql=DROP%20TABLE%20untitle_table_4",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 400
    });
};