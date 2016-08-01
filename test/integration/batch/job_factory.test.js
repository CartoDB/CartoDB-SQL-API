'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../batch/';
var assert = require('../../support/assert');
var JobFactory = require(BATCH_SOURCE + 'models/job_factory');

describe('job factory', function() {

    it('should throw error with invalid fallback query', function () {
        var jobRaw = {
            query: [{
                query: "select * from wadus_table",
                onerror: "select * from wadus_table"
            }]
        };

        assert.throws(function () {
            JobFactory.create(jobRaw);
        });
    });

    it('should throw error with void queries', function () {
        var jobRaw = {
            query: [
                '',
                ''
            ]
        };

        assert.throws(function () {
            JobFactory.create(jobRaw);
        });
    });
});
