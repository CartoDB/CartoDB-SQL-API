require('../helper');

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
  }// ,
  //   'GET /v1/ with SQL parameter': function(){
  //     assert.response(app, {
  //         url: '/v1/?sql=bla',
  //         method: 'GET'
  //     },{
  //         status: 200
  //     });
  //   }
};
