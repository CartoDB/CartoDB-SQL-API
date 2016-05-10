'use strict';

var assert = require('assert');
var queryAdapter = require('../../../batch/query_adapter');

describe('batch API job adapter', function () {
    beforeEach(function () {
        this.queryAdapter = queryAdapter;
    });

    it('should validate simple query', function () {
        var query = 'select * from wadus';
        var adaptedQuery = this.queryAdapter(query);

        assert.deepEqual(adaptedQuery, 'select * from wadus');
    });

    it('should throw error with invalid fallback query (single query)', function () {
        var fallbackQuery = { query: 'select * from wadus' };
        assert.throws(function () {
            this.queryAdapter(fallbackQuery);
        }.bind(this),  /Invalid query/);
    });

    it('should validate multiquery', function () {
        var multiquery = ['select * from wadus'];
        var adaptedQuery = this.queryAdapter(multiquery);

        assert.deepEqual(adaptedQuery, [{
            query: 'select * from wadus',
            status: 'pending'
        }]);
    });

    it('should throw error with invalid fallback query (without fallbacks)', function () {
        var query = [{ query: 'select * from wadus' }];
        assert.throws(function () {
            this.queryAdapter(query);
        }.bind(this),  /Invalid query/);
    });

    it('should validate multiquery (two queries)', function () {
        var multiquery = [
            'select * from wadus',
            'select * from wadus'
        ];

        var adaptedQuery = this.queryAdapter(multiquery);

        assert.deepEqual(adaptedQuery, [{
            query: 'select * from wadus',
            status: 'pending'
        }, {
            query: 'select * from wadus',
            status: 'pending'
        }]);
    });

    it('should throw error with nested multiquery', function () {
        var invalidQuery = [[
            'select * from wadus',
            'select * from wadus'
        ]];

        assert.throws(function () {
            this.queryAdapter(invalidQuery);
        }.bind(this),  /Invalid query/);
    });

    it('should initialize a fallback query ("onerror" for single query)', function () {
        var fallbackQuery = {
            query: [{
                query: 'select * from wadus',
                onerror: 'select * from wadus'
            }]
        };
        var adaptedQuery = this.queryAdapter(fallbackQuery);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                onerror: 'select * from wadus',
                status: 'pending'
            }]
        });
    });

    it('should throw error with nested queries', function () {
        var invalidQuery = [{
            query: {
                query: 'select * from wadus'
            },
            onerror: 'select * from wadus'
        }];

        assert.throws(function () {
            this.queryAdapter(invalidQuery);
        }.bind(this), /Invalid query/);
    });

    it('should initilize fallback query with overall "onsuccess"', function () {
        var fallbackQuery = {
            query: [{
                query: 'select * from wadus',
            }],
            onsuccess: 'select * from wadus'
        };
        var adaptedQuery = this.queryAdapter(fallbackQuery);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                status: 'pending',
            }],
            onsuccess: 'select * from wadus'
        });
    });

    it('should throw error with mixed multiquery-fallback', function () {
        var invalidQuery = [{
            query: [{
                query: 'select * from wadus'
            }],
            onerror: 'select * from wadus'
        }];

        assert.throws(function () {
            this.queryAdapter(invalidQuery);
        }.bind(this), /Invalid query/);
    });

    it('should throw error when overall "onsuccess" fallback is not a single query', function () {
        var invalidQuery = {
            query: ['select * from wadus'],
            onsuccess: {
                query: 'select * from wadus'
            }
        };
        assert.throws(function () {
            this.queryAdapter(invalidQuery);
        }.bind(this), /Invalid query/);
    });

    it('should throw error when overall "onerror" fallback is not a query', function () {
        var invalidQuery = {
            query: ['select * from wadus'],
            onerror: {
                query: 'select * from wadus'
            }
        };
        assert.throws(function () {
            this.queryAdapter(invalidQuery);
        }.bind(this), /Invalid query/);
    });

    it('should initilize fallback-query with "onsuccess" and "onerror" fallback', function () {
        var fallbackQuery = {
            query: [{
                query: 'select * from wadus',
                onsuccess: 'select * from wadus',
                onerror: 'select * from wadus'
            }]
        };

        var adaptedQuery = this.queryAdapter(fallbackQuery);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                onsuccess: 'select * from wadus',
                onerror: 'select * from wadus',
                status: 'pending'
            }]
        });
    });

    it('should initilize fallback-query with overall "onsuccess" fallback', function () {
        var fallbackQuery = {
            query: [
                'select * from wadus',
                'select * from wadus'
            ],
            onsuccess: 'select * from wadus'
        };

        var adaptedQuery = this.queryAdapter(fallbackQuery);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                status: 'pending'
            }, {
                query: 'select * from wadus',
                status: 'pending'
            }],
            onsuccess: 'select * from wadus'
        });
    });

    it('should throw error with nested arrays in fallback-query', function () {
        var fallbackQuery = {
            query: [[
                'select * from wadus'
            ]]
        };

        assert.throws(function () {
            this.queryAdapter(fallbackQuery);
        }.bind(this), /Invalid query/);
    });

    it('should initilize fallback-query wuth two queries with "onerror" overall fallback', function () {
        var query = {
            query: [
                'select * from wadus',
                'select * from wadus'
            ],
            onerror: 'select * from wadus'
        };

        var adaptedQuery = this.queryAdapter(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                status: 'pending'
            }, {
                query: 'select * from wadus',
                status: 'pending'
            }],
            onerror: 'select * from wadus'
        });
    });

    it('should initilize two queries job with "onerror" and "onsuccess" overall fallback', function () {
        var query = {
            query: [
                'select * from wadus',
                'select * from wadus'
            ],
            onerror: 'select * from wadus',
            onsuccess: 'select * from wadus'
        };

        var adaptedQuery = this.queryAdapter(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                status: 'pending'
            }, {
                query: 'select * from wadus',
                status: 'pending'
            }],
            onerror: 'select * from wadus',
            onsuccess: 'select * from wadus'
        });
    });

    it('should adapt two queries, one with "onsuccess" fallback,' +
        ' "onerror" and "onsuccess" overall fallback', function () {
        var query = {
            query: [{
                    query: 'select * from wadus',
                    onsuccess: 'select * from wadus'
                },
                'select * from wadus'
            ],
            onerror: 'select * from wadus',
            onsuccess: 'select * from wadus'
        };

        var adaptedQuery = this.queryAdapter(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                onsuccess: 'select * from wadus',
                status: 'pending'
            }, {
                query: 'select * from wadus',
                status: 'pending'
            }],
            onerror: 'select * from wadus',
            onsuccess: 'select * from wadus'
        });
    });

    it('should adapt two queries, one with "onerror" fallback,' +
        ' "onerror" and "onsuccess" overall fallback', function () {
        var query = {
            query: [
                'select * from wadus', {
                query: 'select * from wadus',
                    onerror: 'select * from wadus'
                }
            ],
            onerror: 'select * from wadus',
            onsuccess: 'select * from wadus'
        };

        var adaptedQuery = this.queryAdapter(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                status: 'pending'
            }, {
                query: 'select * from wadus',
                onerror: 'select * from wadus',
                status: 'pending'
            }],
            onerror: 'select * from wadus',
            onsuccess: 'select * from wadus'
        });
    });

});
