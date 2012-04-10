require('../helper');

var app    = require(global.settings.app_root + '/app/controllers/app')
    , assert = require('assert')
    , tests  = module.exports = {}
    , querystring = require('querystring');

tests['valid api key should allow insert in protected tables'] = function(){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1234&q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('test')&database=cartodb_dev_user_1_db",

        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{
        status: 200
    });
}

tests['invalid api key should NOT allow insert in protected tables'] = function(){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=RAMBO&q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('test')&database=cartodb_dev_user_1_db",

        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{
        status: 400
    });
}


