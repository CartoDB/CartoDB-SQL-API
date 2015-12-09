'use strict';

var BatchLauncher = require('./batch_launcher');
var batchManagerFactory = require('./batch_manager_factory');

module.exports = function (interval, maxJobsPerHost) {
    var batchManager = batchManagerFactory(maxJobsPerHost);
    var batchLauncher = new BatchLauncher(batchManager);

    // here we go!
    batchLauncher.start(interval);
};
