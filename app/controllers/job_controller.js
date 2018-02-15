'use strict';

var _ = require('underscore');
var util = require('util');

var userMiddleware = require('../middlewares/user');
var authenticatedMiddleware = require('../middlewares/authenticated-request');
var handleException = require('../utils/error_handler');
const apikeyMiddleware = require('../middlewares/api-key');

var ONE_KILOBYTE_IN_BYTES = 1024;
var MAX_LIMIT_QUERY_SIZE_IN_KB = 16;
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
        bodyPayloadSizeMiddleware,
        userMiddleware,
        apikeyMiddleware(),
        authenticatedMiddleware(this.userDatabaseService),
        this.createJob.bind(this)
    );
    app.get(
        global.settings.base_url + '/jobs-wip',
        this.listWorkInProgressJobs.bind(this)
    );
    app.get(
        global.settings.base_url + '/sql/job/:job_id',
        userMiddleware,
        apikeyMiddleware(),
        authenticatedMiddleware(this.userDatabaseService),
        this.getJob.bind(this)
    );
    app.delete(
        global.settings.base_url + '/sql/job/:job_id',
        userMiddleware,
        apikeyMiddleware(),
        authenticatedMiddleware(this.userDatabaseService),
        this.cancelJob.bind(this)
    );
};

JobController.prototype.cancelJob = function (req, res) {
    this.jobService.cancel(req.params.job_id, jobResponse(req, res, this.statsdClient, 'cancel'));
};

JobController.prototype.getJob = function (req, res) {
    this.jobService.get(req.params.job_id, jobResponse(req, res, this.statsdClient, 'retrieve'));
};

JobController.prototype.createJob = function (req, res) {
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var sql = (params.query === "" || _.isUndefined(params.query)) ? null : params.query;

    var data = {
        user: res.locals.user,
        query: sql,
        host: res.locals.userDbParams.host,
        port: res.locals.userDbParams.port,
        pass: res.locals.userDbParams.pass,
        dbname: res.locals.userDbParams.dbname,
        dbuser: res.locals.userDbParams.user
    };

    this.jobService.create(data, jobResponse(req, res, this.statsdClient, 'create', 201));
};

JobController.prototype.listWorkInProgressJobs = function (req, res) {
    var self = this;

    this.jobService.listWorkInProgressJobs(function (err, list) {
        if (err) {
            self.statsdClient.increment('sqlapi.job.error');
            return handleException(err, res);
        }

        req.profiler.done('list');
        req.profiler.end();
        req.profiler.sendStats();

        res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
        self.statsdClient.increment('sqlapi.job.success');

        if (process.env.NODE_ENV !== 'test') {
            console.info(JSON.stringify({
                type: 'sql_api_batch_job',
                username: res.locals.user,
                action: 'list'
            }));
        }

        res.status(200).send(list);
    });
};

function jobResponse(req, res, statsdClient, action, status) {
    return function handler(err, job) {
        status = status || 200;

        if (err) {
            statsdClient.increment('sqlapi.job.error');
            return handleException(err, res);
        }

        res.header('X-Served-By-DB-Host', res.locals.userDbParams.host);

        req.profiler.done(action);
        req.profiler.end();
        req.profiler.sendStats();

        res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
        statsdClient.increment('sqlapi.job.success');

        if (process.env.NODE_ENV !== 'test') {
            console.info(JSON.stringify({
                type: 'sql_api_batch_job',
                username: res.locals.user,
                action: action,
                job_id: job.job_id
            }));
        }

        res.status(status).send(job.serialize());
    };
}
