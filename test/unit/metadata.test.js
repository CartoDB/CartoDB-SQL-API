/**
 * User: simon
 * Date: 24/08/2011
 * Time: 13:03
 * Desc: Tests for the metadata model
 *
 * in order to run this test, please ensure you have set the following in Redis:
 *
 * SELECT 5
 * HSET rails:users:simon id 5
 * HSET rails:users:simon database_name simons_database
 */

require('../helper');

var _      = require('underscore')
    , redis  = require("redis")
    , MetaData  = require('../../app/models/metadata')
    , assert = require('assert')

    , tests  = module.exports = {};

tests['test can retrieve database name from header and redis'] = function(){
    var req = {headers: {host: 'simon.cartodb.com'}};
    
    MetaData.getDatabase(req, function(err, data){
        assert.equal(data, 'simons_database');
    });
};

tests['test can retrieve id from header and redis'] = function(){
    var req = {headers: {host: 'simon.cartodb.com'}};

    MetaData.getId(req, function(err, data){
        assert.equal(data, '5');
    });
};
