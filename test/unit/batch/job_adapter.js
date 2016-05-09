'use strict';

var assert = require('assert');
var QueryAdapter = require('../../../batch/query_adapter');

describe('batch API job adapter', function () {
    beforeEach(function () {
        this.queryAdapter = new QueryAdapter();
    });

    it('.adapt() should adapt one query job', function () {
        var query = 'select * from wadus';
        var adaptedQuery = this.queryAdapter.adapt(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                status: 'pending'
            }]
        });
    });

    it('.adapt() should throw error with simple object query', function () {
        var query = { query: 'select * from wadus' };
        assert.throws(function () {
            this.queryAdapter.adapt(query);
        }, 'Invalid query');
    });

    it('.adapt() should adapt one query job', function () {
        var query = ['select * from wadus'];
        var adaptedQuery = this.queryAdapter.adapt(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                status: 'pending'
            }]
        });
    });

    it('.adapt() should throw error with simple object query inside array', function () {
        var query = [{ query: 'select * from wadus' }];
        assert.throws(function () {
            this.queryAdapter.adapt(query);
        }, 'Invalid query');
    });

    it('.adapt() should adapt two queries job', function () {
        var query = [
            'select * from wadus',
            'select * from wadus'
        ];

        var adaptedQuery = this.queryAdapter.adapt(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                status: 'pending'
            }, {
                query: 'select * from wadus',
                status: 'pending'
            }]
        });
    });

    it('.adapt() should throw error with array query wrapped array', function () {
        var query = [[
            'select * from wadus',
            'select * from wadus'
        ]];
        assert.throws(function () {
            this.queryAdapter.adapt(query);
        }, 'Invalid query');
    });

    it('.adapt() should adapt a query job with "onerror" fallback', function () {
        var query = [{
            query: 'select * from wadus',
            onerror: 'select * from wadus'
        }];
        var adaptedQuery = this.queryAdapter.adapt(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                onerror: 'select * from wadus',
                status: 'pending'
            }]
        });
    });

    it('.adapt() should adapt one query job with "onsuccess" fallback', function () {
        var query = [{
            query: 'select * from wadus',
            onsuccess: 'select * from wadus'
        }];
        var adaptedQuery = this.queryAdapter.adapt(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                status: 'pending',
                onsuccess: 'select * from wadus'
            }]
        });
    });

    it('.adapt() should adapt one query job with "onsuccess" and "onerror" fallback', function () {
        var query = [{
            query: 'select * from wadus',
            onsuccess: 'select * from wadus',
            onerror: 'select * from wadus'
        }];
        var adaptedQuery = this.queryAdapter.adapt(query);

        assert.deepEqual(adaptedQuery, {
            query: [{
                query: 'select * from wadus',
                onsuccess: 'select * from wadus',
                onerror: 'select * from wadus',
                status: 'pending'
            }]
        });
    });

    it('.adapt() should adapt two queries job with "onsuccess" overall fallback', function () {
        var query = {
            query: [
                'select * from wadus',
                'select * from wadus'
            ],
            onsuccess: 'select * from wadus'
        };

        var adaptedQuery = this.queryAdapter.adapt(query);

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

    it('.adapt() should adapt two queries job with "onerror" overall fallback', function () {
        var query = {
            query: [
                'select * from wadus',
                'select * from wadus'
            ],
            onerror: 'select * from wadus'
        };

        var adaptedQuery = this.queryAdapter.adapt(query);

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

    it('.adapt() should adapt two queries job with "onerror" and "onsuccess" overall fallback', function () {
        var query = {
            query: [
                'select * from wadus',
                'select * from wadus'
            ],
            onerror: 'select * from wadus',
            onsuccess: 'select * from wadus'
        };

        var adaptedQuery = this.queryAdapter.adapt(query);

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

    it('.adapt() should adapt two queries, one with "onsuccess" fallback,' +
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

        var adaptedQuery = this.queryAdapter.adapt(query);

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

    it('.adapt() should adapt two queries, one with "onerror" fallback,' +
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

        var adaptedQuery = this.queryAdapter.adapt(query);

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
