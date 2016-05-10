'use strict';

var assert = require('assert');
var queryDispatcher = require('../../../batch/query_dispatcher');

describe('batch API query dispatcher', function () {
    beforeEach(function () {
        this.queryDispatcher = queryDispatcher;
    });

    var scenarios = [{
        description: 'simple job with status pending should return the query',
        job: {
            job_id: 'job-id-simple',
            query: 'query-simple',
            status: 'pending'
        },
        queryExpected: {
            query: 'query-simple'
        }
    }, {
        description: 'simple job with status running should return undefined',
        job: {
            job_id: 'job-id-simple',
            query: 'query-simple',
            status: 'running'
        },
        queryExpected: undefined
    }, {
        description: 'simple job with status done should return undefined',
        job: {
            job_id: 'job-id-simple',
            query: 'query-simple',
            status: 'done'
        },
        queryExpected: undefined
    }, {
        description: 'simple job with status failed should return undefined',
        job: {
            job_id: 'job-id-simple',
            query: 'query-simple',
            status: 'failed'
        },
        queryExpected: undefined
    }, {
        description: 'simple job with status unknown should return undefined',
        job: {
            job_id: 'job-id-simple',
            query: 'query-simple',
            status: 'unknown'
        },
        queryExpected: undefined
    }, {
        description: 'multiple job with status pending should return first query',
        job: {
            job_id: 'job-id-multiple',
            query: [{
                query: 'query-multiple-01',
                status: 'pending'
            }, {
                query: 'query-multiple-02',
                status: 'pending'
            }],
            status: 'pending'
        },
        queryExpected: {
            index: 0,
            query: 'query-multiple-01'
        }
    }, {
        description: 'multiple job with status pending should return second query',
        job: {
            job_id: 'job-id-multiple',
            query: [{
                query: 'query-multiple-01',
                status: 'done'
            }, {
                query: 'query-multiple-02',
                status: 'pending'
            }],
            status: 'pending'
        },
        queryExpected: {
            index: 1,
            query: 'query-multiple-02'
        }
    }, {
        description: 'multiple job with status done should return undefined',
        job: {
            job_id: 'job-id-multiple',
            query: [{
                query: 'query-multiple-01',
                status: 'done'
            }, {
                query: 'query-multiple-02',
                status: 'done'
            }],
            status: 'done'
        },
        queryExpected: undefined
    }, {
        description: 'multiple job with status failed should return undefined',
        job: {
            job_id: 'job-id-multiple',
            query: [{
                query: 'query-multiple-01',
                status: 'failed'
            }, {
                query: 'query-multiple-02',
                status: 'pending'
            }],
            status: 'failed'
        },
        queryExpected: undefined
    }, {
        description: 'fallback job with status pending should return first query',
        job: {
            job_id: 'job-id-fallback',
            query: {
                query: [{
                    query: 'query-fallback-01',
                    status: 'pending'
                }],
                onerror: 'query-fallback-onerror-01',
                onsuccess: 'query-fallback-onsuccess-01'
            },
            status: 'pending'
        },
        queryExpected: {
            index: 0,
            query: 'query-fallback-01'
        }
    }, {
        description: 'fallback job with status done should return onsuccess fallback',
        job: {
            job_id: 'job-id-fallback',
            query: {
                query: [{
                    query: 'query-fallback-01',
                    status: 'done'
                }],
                onerror: 'query-fallback-onerror-01',
                onsuccess: 'query-fallback-onsuccess-01'
            },
            status: 'pending'
        },
        queryExpected: {
            query: 'query-fallback-onsuccess-01'
        }
    }, {
        description: 'fallback job with status failed should return onerror fallback',
        job: {
            job_id: 'job-id-fallback',
            query: {
                query: [{
                    query: 'query-fallback-01',
                    status: 'failed'
                }],
                onerror: 'query-fallback-onerror-01',
                onsuccess: 'query-fallback-onsuccess-01'
            },
            status: 'pending'
        },
        queryExpected: {
            query: 'query-fallback-onerror-01'
        }
    }, {
        description: 'fallback job with status pending should return onerror fallback',
        job: {
            job_id: 'job-id-fallback',
            query: {
                query: [{
                    query: 'query-fallback-01',
                    status: 'done'
                }, {
                    query: 'query-fallback-02',
                    status: 'pending'
                }],
                onsuccess: 'query-fallback-onsuccess-01'
            },
            status: 'pending'
        },
        queryExpected: {
            index: 0,
            query: 'query-fallback-01'
        }
    }];

    scenarios.forEach(function (scenario) {
        it(scenario.description, function () {
            assert.deepEqual(this.queryDispatcher(scenario.job), scenario.queryExpected);
        });
    });
});
