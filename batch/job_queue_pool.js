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

JobQueuePool.prototype.removeQueue = function (host) {
    if (this.queues[host].queue) {
        delete this.queues[host].queue;
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

JobQueuePool.prototype.getCurrentJobId = function (host) {
    if (this.get(host).currentJobId) {
        return this.get(host).currentJobId;
    }
};

JobQueuePool.prototype.removeCurrentJobId = function (host) {
    if (this.get(host).currentJobId) {
        delete this.get(host).currentJobId;
    }
};

module.exports = JobQueuePool;
