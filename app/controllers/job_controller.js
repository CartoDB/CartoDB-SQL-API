'use strict';

var _ = require('underscore');
var step = require('step');
var assert = require('assert');

var UserDatabaseService = require('../services/user_database_service');
var JobPublisher = require('../../batch/job_publisher');
var JobQueueProducer = require('../../batch/job_queue_producer');
var JobBackend = require('../../batch/job_backend');
var CdbRequest = require('../models/cartodb_request');
var handleException = require('../utils/error_handler');

var cdbReq = new CdbRequest();
var userDatabaseService = new UserDatabaseService();
var jobPublisher = new JobPublisher();

function JobController(metadataBackend, tableCache, statsd_client) {
    this.metadataBackend = metadataBackend;
    this.tableCache = tableCache;
    this.statsd_client = statsd_client;
    this.jobQueueProducer = new JobQueueProducer(metadataBackend);
    this.jobBackend = new JobBackend(metadataBackend);
}

JobController.prototype.route = function (app) {
    app.post(global.settings.base_url + '/job',  this.createJob.bind(this));
    app.get(global.settings.base_url + '/job/:jobId',  this.getJob.bind(this));
};

JobController.prototype.getJob = function (req, res) {
    var self = this;
    var jobId = req.params.jobId;
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var cdbUsername = cdbReq.userByReq(req);

    if (!_.isString(jobId)) {
        return handleException(new Error("You must indicate a job id"), res);
    }

    if ( req.profiler ) {
        req.profiler.start('sqlapi.job');
    }

    req.aborted = false;
    req.on("close", function() {
        if (req.formatter && _.isFunction(req.formatter.cancel)) {
            req.formatter.cancel();
        }
        req.aborted = true; // TODO: there must be a builtin way to check this
    });

    function checkAborted(step) {
      if ( req.aborted ) {
        var err = new Error("Request aborted during " + step);
        // We'll use status 499, same as ngnix in these cases
        // see http://en.wikipedia.org/wiki/List_of_HTTP_status_codes#4xx_Client_Error
        err.http_status = 499;
        throw err;
      }
    }

    if ( req.profiler ) {
        req.profiler.done('init');
    }

    step(
        function getUserDBInfo() {
            var options = {
                req: req,
                params: params,
                checkAborted: checkAborted,
                metadataBackend: self.metadataBackend,
                cdbUsername: cdbUsername
            };
            userDatabaseService.getUserDatabase(options, this);
        },
        function getJob(err, userDatabase) {
            assert.ifError(err);

            if (!userDatabase.authenticated) {
                throw new Error('permission denied');
            }

            var next = this;

            checkAborted('persistJob');

            if ( req.profiler ) {
                req.profiler.done('setDBAuth');
            }

            self.jobBackend.get(jobId, function (err, job) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    job: job,
                    userDatabase: userDatabase
                });
            });
        },
        function handleResponse(err, result) {
            if ( err ) {
                return handleException(err, res);
            }

            if ( req.profiler ) {
                req.profiler.done('enqueueJob');
                res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
            }

            if (global.settings.api_hostname) {
              res.header('X-Served-By-Host', global.settings.api_hostname);
            }

            if (result.host) {
              res.header('X-Served-By-DB-Host', result.host);
            }

            res.send(result.job);
        }
    );
};

// jshint maxcomplexity:21
JobController.prototype.createJob = function (req, res) {
    var self = this;
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var sql = (params.query === "" || _.isUndefined(params.query)) ? null : params.query;
    var cdbUsername = cdbReq.userByReq(req);

    if (!_.isString(sql)) {
        return handleException(new Error("You must indicate a sql query"), res);
    }

    if ( req.profiler ) {
        req.profiler.start('sqlapi.job');
    }

    req.aborted = false;
    req.on("close", function() {
        if (req.formatter && _.isFunction(req.formatter.cancel)) {
            req.formatter.cancel();
        }
        req.aborted = true; // TODO: there must be a builtin way to check this
    });

    function checkAborted(step) {
      if ( req.aborted ) {
        var err = new Error("Request aborted during " + step);
        // We'll use status 499, same as ngnix in these cases
        // see http://en.wikipedia.org/wiki/List_of_HTTP_status_codes#4xx_Client_Error
        err.http_status = 499;
        throw err;
      }
    }

    if ( req.profiler ) {
        req.profiler.done('init');
    }

    step(
        function getUserDBInfo() {
            var options = {
                req: req,
                params: params,
                checkAborted: checkAborted,
                metadataBackend: self.metadataBackend,
                cdbUsername: cdbUsername
            };
            userDatabaseService.getUserDatabase(options, this);
        },
        function persistJob(err, userDatabase) {
            assert.ifError(err);

            if (!userDatabase.authenticated) {
                throw new Error('permission denied');
            }

            var next = this;

            checkAborted('persistJob');

            if ( req.profiler ) {
                req.profiler.done('setDBAuth');
            }

            self.jobBackend.create(cdbUsername, sql, function (err, result) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    job: result,
                    userDatabase: userDatabase
                });
            });
        },
        function enqueueJob(err, result) {
            assert.ifError(err);

            if ( req.profiler ) {
                req.profiler.done('persistJob');
            }

            checkAborted('enqueueJob');

            var next = this;

            self.jobQueueProducer.enqueue(result.job.jobId, result.userDatabase.host, function (err) {
                if (err) {
                    return next(err);
                }

                // broadcast to consumers
                jobPublisher.publish(result.userDatabase.host);

                next(null, {
                    job: result.job,
                    host: result.userDatabase.host
                });
            });
        },
        function handleResponse(err, result) {
            if ( err ) {
                return handleException(err, res);
            }

            if ( req.profiler ) {
                req.profiler.done('enqueueJob');
                res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
            }

            if (global.settings.api_hostname) {
              res.header('X-Served-By-Host', global.settings.api_hostname);
            }

            if (result.host) {
              res.header('X-Served-By-DB-Host', result.host);
            }
            res.send(result.job);
        }
    );
};

module.exports = JobController;
