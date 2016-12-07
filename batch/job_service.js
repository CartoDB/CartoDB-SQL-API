'use strict';

var debug = require('./util/debug')('job-service');
var JobFactory = require('./models/job_factory');
var jobStatus = require('./job_status');

function JobService(jobBackend, jobCanceller) {
    this.jobBackend = jobBackend;
    this.jobCanceller = jobCanceller;
}

module.exports = JobService;

JobService.prototype.get = function (job_id, callback) {
    this.jobBackend.get(job_id, function (err, data) {
        if (err) {
            return callback(err);
        }

        var job;

        try {
            job = JobFactory.create(data);
        } catch (err) {
            return callback(err);
        }

        callback(null, job);
    });
};

JobService.prototype.create = function (data, callback) {
    try {
        var job = JobFactory.create(data);
        job.validate();
        this.jobBackend.create(job.data, function (err) {
            if (err) {
                return callback(err);
            }
            callback(null, job);
        });
    } catch (err) {
        return callback(err);
    }
};

JobService.prototype.save = function (job, callback) {
    var self = this;

    try {
        job.validate();
    } catch (err) {
        return callback(err);
    }

    self.jobBackend.update(job.data, function (err, data) {
        if (err) {
            return callback(err);
        }

        try {
            job = JobFactory.create(data);
        } catch (err) {
            return callback(err);
        }

        callback(null, job);
    });
};

JobService.prototype.cancel = function (job_id, callback) {
    var self = this;

    self.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        var isPending = job.isPending();

        try {
            job.setStatus(jobStatus.CANCELLED);
        } catch (err) {
            return callback(err);
        }

        if (isPending) {
            return self.save(job, callback);
        }

        self.jobCanceller.cancel(job, function (err) {
            if (err) {
                return callback(err);
            }

            self.save(job, callback);
        });
    });
};

JobService.prototype.drain = function (job_id, callback) {
    var self = this;

    self.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        self.jobCanceller.cancel(job, function (err) {
            if (err) {
                debug('There was an error while draining job %s, %s ', job_id, err);
                return callback(err);
            }

            try {
                job.setStatus(jobStatus.PENDING);
            } catch (err) {
                return callback(err);
            }

            self.jobBackend.update(job.data, callback);
        });
    });
};

JobService.prototype.addWorkInProgressJob = function (user, jobId, callback) {
    this.jobBackend.addWorkInProgressJob(user, jobId, callback);
};

JobService.prototype.clearWorkInProgressJob = function (user, jobId, callback) {
    this.jobBackend.clearWorkInProgressJob(user, jobId, callback);
};

JobService.prototype.listWorkInProgressJobs = function (callback) {
    this.jobBackend.listWorkInProgressJobs(callback);
};
