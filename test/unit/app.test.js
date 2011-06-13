require('../helper');

var _      = require('underscore')
  , assert = require('assert');

exports['test String#length'] = function(){
    assert.equal(6, 'foobar'.length);
};