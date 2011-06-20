require('../helper');

// Requires the database and tables setup in config/environments/test.js to exist
// Ensure the user is present in the pgbouncer auth file too

var app    = require(global.settings.app_root + '/app/controllers/app')
  , assert = require('assert');

module.exports = {
  'GET /v1/': function(){
    assert.response(app, {
        url: '/v1/',
        method: 'GET'
    },{
        body: '{"error":["You must indicate a sql query"]}',
        status: 400
    });
  },
  'GET /v1/ with SQL parameter on SELECT only. No oAuth included ': function(){
    assert.response(app, {
      url: '/v1/?sql=SELECT%20*%20FROM%20test_table&database=cartodb_test_user_1_db',
      method: 'GET'
    },{
      status: 200
    });
  },
  'GET /v1/ with SQL parameter on SELECT only. oAuth used ': function(){
    assert.response(app, {
      url: '/v1/?sql=SELECT%20*%20FROM%20test_table&oauth_token=1',
      method: 'GET'
    },{
      status: 200
    });
  },
  'GET /v1/ with SQL parameter on INSERT only. oAuth used ': function(){
    assert.response(app, {
      url: "/v1/?sql=INSERT%20INTO%20test_table%20(id)%20VALUES%20(1)&oauth_token=1",
      method: 'GET'
    },{
      status: 200
    });
  }

};
