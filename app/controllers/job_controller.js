'use strict';

var _ = require('underscore');
var step = require('step');
var util = require('util');

var userMiddleware = require('../middlewares/user');
var authenticatedMiddleware = require('../middlewares/authenticated-request');
var handleException = require('../utils/error_handler');

var ONE_KILOBYTE_IN_BYTES = 1024;
var MAX_LIMIT_QUERY_SIZE_IN_KB = 8;
var MAX_LIMIT_QUERY_SIZE_IN_BYTES = MAX_LIMIT_QUERY_SIZE_IN_KB * ONE_KILOBYTE_IN_BYTES;

function getMaxSizeErrorMessage(sql) {
    return util.format([
            'Your payload is too large: %s bytes. Max size allowed is %s bytes (%skb).',
            'Are you trying to import data?.',
            'Please, check out import api http://docs.cartodb.com/cartodb-platform/import-api/'
        ].join(' '),
        sql.length,
        MAX_LIMIT_QUERY_SIZE_IN_BYTES,
        Math.round(MAX_LIMIT_QUERY_SIZE_IN_BYTES / ONE_KILOBYTE_IN_BYTES)
    );
}

function JobController(userDatabaseService, jobService, statsdClient) {
    this.userDatabaseService = userDatabaseService;
    this.jobService = jobService;
    this.statsdClient = statsdClient || { increment: function () {} };
}

function bodyPayloadSizeMiddleware(req, res, next) {
    var payload = JSON.stringify(req.body);
    if (payload.length > MAX_LIMIT_QUERY_SIZE_IN_BYTES) {
        return handleException(new Error(getMaxSizeErrorMessage(payload)), res);
    } else {
        return next(null);
    }
}

module.exports = JobController;
module.exports.MAX_LIMIT_QUERY_SIZE_IN_BYTES = MAX_LIMIT_QUERY_SIZE_IN_BYTES;
module.exports.getMaxSizeErrorMessage = getMaxSizeErrorMessage;

JobController.prototype.route = function (app) {
    app.post(
        global.settings.base_url + '/sql/job',
        bodyPayloadSizeMiddleware, userMiddleware, authenticatedMiddleware(this.userDatabaseService),
        this.createJob.bind(this)
    );
    app.get(
        global.settings.base_url + '/sql/job/:job_id',
        userMiddleware, authenticatedMiddleware(this.userDatabaseService),
        this.getJob.bind(this)
    );
    app.delete(
        global.settings.base_url + '/sql/job/:job_id',
        userMiddleware, authenticatedMiddleware(this.userDatabaseService),
        this.cancelJob.bind(this)
    );
};

JobController.prototype.cancelJob = function (req, res) {
    var self = this;
    var job_id = req.params.job_id;

    step(
        function cancelJob() {
            var next = this;
            self.jobService.cancel(job_id, function (err, job) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    job: job.serialize(),
                    host: req.context.userDatabase.host
                });
            });
        },
        function handleResponse(err, result) {
            if ( err ) {
                self.statsdClient.increment('sqlapi.job.error');
                return handleException(err, res);
            }

            if (global.settings.api_hostname) {
                res.header('X-Served-By-Host', global.settings.api_hostname);
            }

            if (result.host) {
                res.header('X-Served-By-DB-Host', result.host);
            }

            req.profiler.done('cancelJob');
            req.profiler.end();
            req.profiler.sendStats();

            res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());

            self.statsdClient.increment('sqlapi.job.success');

            res.send(result.job);
        }
    );
};

JobController.prototype.getJob = function (req, res) {
    var self = this;
    var job_id = req.params.job_id;

    step(
        function getJob() {
            var next = this;
            self.jobService.get(job_id, function (err, job) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    job: job.serialize(),
                    host: req.context.userDatabase.host
                });
            });
        },
        function handleResponse(err, result) {
            if ( err ) {
                self.statsdClient.increment('sqlapi.job.error');
                return handleException(err, res);
            }

            if (global.settings.api_hostname) {
                res.header('X-Served-By-Host', global.settings.api_hostname);
            }

            if (result.host) {
                res.header('X-Served-By-DB-Host', result.host);
            }

            req.profiler.done('getJob');
            req.profiler.end();
            req.profiler.sendStats();

            res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());

            self.statsdClient.increment('sqlapi.job.success');

            res.send(result.job);
        }
    );
};

JobController.prototype.createJob = function (req, res) {
    var self = this;
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var sql = (params.query === "" || _.isUndefined(params.query)) ? null : params.query;

    step(
        function persistJob() {
            var next = this;

            var data = {
                user: req.context.user,
                query: sql,
                host: req.context.userDatabase.host
            };

            self.jobService.create(data, function (err, job) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    job: job.serialize(),
                    host: req.context.userDatabase.host
                });
            });
        },
        function handleResponse(err, result) {
            if ( err ) {
                self.statsdClient.increment('sqlapi.job.error');
                return handleException(err, res);
            }

            if (global.settings.api_hostname) {
                res.header('X-Served-By-Host', global.settings.api_hostname);
            }

            if (result.host) {
                res.header('X-Served-By-DB-Host', result.host);
            }

            req.profiler.done('persistJob');
            req.profiler.end();
            req.profiler.sendStats();

            res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());

            self.statsdClient.increment('sqlapi.job.success');

            console.info(JSON.stringify({
                type: 'sql_api_batch_job',
                username: req.context.user,
                action: 'create',
                job_id: result.job.job_id
            }));

            res.status(201).send(result.job);
        }
    );
};
