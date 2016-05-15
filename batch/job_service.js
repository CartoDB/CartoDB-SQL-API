'use strict';

var JobFactory = require('./job_factory');
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

JobService.prototype.list = function (user, callback) {
    this.jobBackend.list(user, function (err, dataList) {
        if (err) {
            return callback(err);
        }

        var jobList = dataList.map(function (data) {
            var job;

            try {
                job = JobFactory.create(data);
            } catch (err) {
                return console.err(err);
            }

            return job;
        })
        .filter(function (job) {
            return job !== undefined;
        });

        callback(null, jobList);
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

JobService.prototype.update = function (data, callback) {
    var self = this;

    self.get(data.job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        try {
            job.setQuery(data.query);
            self.save(job, callback);
        } catch (err) {
            return callback(err);
        }
    });
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
                console.error('There was an error while draining job %s, %s ', job_id, err);
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
