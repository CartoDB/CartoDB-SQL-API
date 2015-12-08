'use strict';

function JobsCounter(maxJobsPerIntance) {
    this.maxJobsPerIntance =  maxJobsPerIntance || global.settings.max_jobs_per_instance;
    this.hosts = {};
}

JobsCounter.prototype.increment = function (host) {
    if (this[host] < this.maxJobsPerHost) {
        this[host] += 1;
        return true;
    }
    return false;
};

JobsCounter.prototype.decrement = function (host) {
    if (this[host] > 0) {
        this[host] -= 1;
        return true;
    }
    return false;
 };

module.exports = JobsCounter;
