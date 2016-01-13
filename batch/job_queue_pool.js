'use strict';

var JobQueue = require('./job_queue');

function JobQueuePool(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.queues = {};
}

JobQueuePool.prototype.get = function (host) {
    return this.queues[host];
};

JobQueuePool.prototype.getQueue = function (host) {
    if (this.get(host)) {
        return this.get(host).queue;
    }
};

JobQueuePool.prototype.list = function () {
    return Object.keys(this.queues);
};

JobQueuePool.prototype.createQueue = function (host) {
    this.queues[host] = {
        queue: new JobQueue(this.metadataBackend),
        currentJobId: null
    };

    return this.getQueue(host);
};

JobQueuePool.prototype.setCurrentJobId = function (host, job_id) {
    this.get(host).currentJobId = job_id;
};

JobQueuePool.prototype.remove = function (host) {
    delete this.queues[host];
};

module.exports = JobQueuePool;
