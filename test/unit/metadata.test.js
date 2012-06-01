require('../helper');

var _      = require('underscore')
    , redis  = require("redis")
    , MetaData  = require('../../app/models/metadata')
    , assert = require('assert')

    , tests  = module.exports = {};

tests['test can retrieve database name from header and redis'] = function(){
    var req = {headers: {host: 'vizzuality.cartodb.com'}};
    
    MetaData.getDatabase(req, function(err, data){
        assert.equal(data, 'cartodb_test_user_1_db');
    });
};

tests['test can retrieve id from header and redis'] = function(){
    var req = {headers: {host: 'vizzuality.cartodb.com'}};

    MetaData.getId(req, function(err, data){
        assert.equal(data, '1');
    });
};
