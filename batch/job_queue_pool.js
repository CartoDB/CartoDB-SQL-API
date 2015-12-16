'use strict';

function JobQueuePool() {
    this.queues = {};
}

JobQueuePool.prototype.get = function (host) {
    return this.queues[host];
};

JobQueuePool.prototype.list = function () {
    return Object.keys(this.queues);
};

JobQueuePool.prototype.add = function (host, queue) {
    this.queues[host] = queue;
};

JobQueuePool.prototype.remove = function (host) {
    delete this.queues[host];
};

module.exports = JobQueuePool;
