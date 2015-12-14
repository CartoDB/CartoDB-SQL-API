'use strict';

var BatchLauncher = require('./batch_launcher');
var batchManagerFactory = require('./batch_manager_factory');

module.exports = function (metadataBackend, interval, maxJobsPerHost) {
    var batchManager = batchManagerFactory(metadataBackend, maxJobsPerHost);
    var batchLauncher = new BatchLauncher(batchManager);

    // here we go!
    batchLauncher.start(interval);
};
