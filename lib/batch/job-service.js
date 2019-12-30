'use strict';

var JobFactory = require('./models/job-factory');
var jobStatus = require('./job-status');

function JobService (jobBackend, jobCanceller, logger) {
    this.jobBackend = jobBackend;
    this.jobCanceller = jobCanceller;
    this.logger = logger;
}

module.exports = JobService;

JobService.prototype.get = function (jobId, callback) {
    this.jobBackend.get(jobId, function (err, data) {
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

JobService.prototype.cancel = function (jobId, callback) {
    var self = this;

    self.get(jobId, function (err, job) {
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

JobService.prototype.drain = function (jobId, callback) {
    var self = this;

    self.get(jobId, function (err, job) {
        if (err) {
            return callback(err);
        }

        self.jobCanceller.cancel(job, function (err) {
            if (err) {
                self.logger.debug('There was an error while draining job %s, %s ', jobId, err);
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
