'use strict';

var JobQueue = require('./job_queue');

function JobQueuePool(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.queues = {};
}

JobQueuePool.prototype.get = function (host) {
    return this.queues[host];
};

JobQueuePool.prototype.list = function () {
    return Object.keys(this.queues);
};

JobQueuePool.prototype.add = function (host) {
    this.queues[host] = new JobQueue(this.metadataBackend);
    return this.get(host);
};

JobQueuePool.prototype.remove = function (host) {
    delete this.queues[host];
};

module.exports = JobQueuePool;
