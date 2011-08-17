require('../helper');

// Requires the database and tables setup in config/environments/test.js to exist
// Ensure the user is present in the pgbouncer auth file too

var app    = require(global.settings.app_root + '/app/controllers/app')
  , assert = require('assert');

var real_oauth_header = 'OAuth realm="http://vizzuality.testhost.lan/",oauth_consumer_key="fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2",oauth_token="l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR",oauth_signature_method="HMAC-SHA1", oauth_signature="o4hx4hWP6KtLyFwggnYB4yPK8xI%3D",oauth_timestamp="1313581372",oauth_nonce="W0zUmvyC4eVL8cBd4YwlH1nnPTbxW0QBYcWkXTwe4",oauth_version="1.0"'  


module.exports = {
  'GET /api/v1/': function(){
        assert.response(app, {
            url: '/api/v1/',
            method: 'GET'
        },{
            body: '{"error":["You must indicate a sql query"]}',
            status: 400
        });
      },
      'GET /api/v1/ with SQL parameter on SELECT only. No oAuth included ': function(){
        assert.response(app, {
          url: '/api/v1/?sql=SELECT%20*%20FROM%20test_table&database=cartodb_test_user_1_db',
          method: 'GET'
        },{
          status: 200
        });
      },
  // 'GET /api/v1/ with SQL parameter on SELECT only. oAuth used ': function(){
  //   assert.response(app, {
  //     headers: {}
  //     url: '/api/v1/?sql=SELECT%20*%20FROM%20test_table&oauth_token=1',
  //     method: 'GET'
  //   },{
  //     status: 200
  //   });
  // },
  // 'GET /api/v1/ with SQL parameter on INSERT only. oAuth used ': function(){
  //   assert.response(app, {
  //     url: "/api/v1/?sql=INSERT%20INTO%20test_table%20(id)%20VALUES%20(1)&oauth_token=1",
  //     method: 'GET'
  //   },{
  //     status: 200
  //   });
  // },
  'GET /api/v1/ with SQL parameter on INSERT only. oAuth not used, so public user - should fail': function(){
    assert.response(app, {
      url: "/api/v1/?sql=INSERT%20INTO%20test_table%20(id)%20VALUES%20(1)&database=cartodb_test_user_1_db",
      method: 'GET'
    },{
      status: 400
    });
  },
  'GET /api/v1/ with SQL parameter on DROP DATABASE only. oAuth not used, so public user - should fail': function(){
    assert.response(app, {
      url: "/api/v1/?sql=DROP%20TABLE%20cartodb_test_user_1_db&database=cartodb_test_user_1_db",
      method: 'GET'
    },{
      status: 400
    });
  }
  
};
