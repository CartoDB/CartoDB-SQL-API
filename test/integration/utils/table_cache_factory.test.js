'use strict';

require('../../helper');
var assert = require('assert');
var LRU = require('lru-cache');
var NoCache = require('../../../app/utils/no_cache');

var TableCacheFactory = require('../../../app/utils/table_cache_factory');
var factory = new TableCacheFactory();

describe('TableCacheFactory', function() {

    it('returns a NoCache by default', function() {
        var tableCache = factory.build({});
        assert(tableCache instanceof NoCache);
    });

    it('returns a NoCache if it is disabled in settings', function() {
        var tableCache = factory.build({tableCacheEnabled: false});
        assert(tableCache instanceof NoCache);
    });

    it('returns an LRU if enabled in settings, with its default settings', function() {
        var tableCache = factory.build({tableCacheEnabled: true});
        assert(tableCache instanceof LRU);
        assert.equal(tableCache._max, 8192);
        assert.equal(tableCache._maxAge, 1000*60*10);
    });

    it('returns an LRU if enabled in settings, with the passed settings', function() {
        var tableCache = factory.build({
            tableCacheEnabled: true,
            tableCacheMax: 42,
            tableCacheMaxAge: 1000
        });
        assert(tableCache instanceof LRU);
        assert.equal(tableCache._max, 42);
        assert.equal(tableCache._maxAge, 1000);
    });

});
