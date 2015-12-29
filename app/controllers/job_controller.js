'use strict';

var _ = require('underscore');
var step = require('step');
var assert = require('assert');

var UserDatabaseService = require('../services/user_database_service');
var JobPublisher = require('../../batch/job_publisher');
var JobQueue = require('../../batch/job_queue');
var UserIndexer = require('../../batch/user_indexer');
var JobBackend = require('../../batch/job_backend');
var CdbRequest = require('../models/cartodb_request');
var handleException = require('../utils/error_handler');

var cdbReq = new CdbRequest();
var userDatabaseService = new UserDatabaseService();

function JobController(metadataBackend, tableCache, statsd_client) {
    var jobQueue = new JobQueue(metadataBackend);
    var jobPublisher = new JobPublisher();
    var userIndexer = new UserIndexer(metadataBackend);

    this.metadataBackend = metadataBackend;
    this.tableCache = tableCache;
    this.statsd_client = statsd_client;
    this.jobBackend = new JobBackend(metadataBackend, jobQueue, jobPublisher, userIndexer);
}

JobController.prototype.route = function (app) {
    app.post(global.settings.base_url + '/job',  this.createJob.bind(this));
    app.get(global.settings.base_url + '/job',  this.listJob.bind(this));
    app.get(global.settings.base_url + '/job/:job_id',  this.getJob.bind(this));
};

JobController.prototype.listJob = function (req, res) {
    var self = this;
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var cdbUsername = cdbReq.userByReq(req);

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
        function listJob(err, userDatabase) {
            assert.ifError(err);

            if (!userDatabase.authenticated) {
                throw new Error('permission denied');
            }

            var next = this;

            checkAborted('persistJob');

            if ( req.profiler ) {
                req.profiler.done('setDBAuth');
            }

            self.jobBackend.list(cdbUsername, function (err, jobs) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    jobs: jobs,
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

            res.send(result.jobs);
        }
    );
};

JobController.prototype.getJob = function (req, res) {
    var self = this;
    var job_id = req.params.job_id;
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var cdbUsername = cdbReq.userByReq(req);

    if (!_.isString(job_id)) {
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

            self.jobBackend.get(job_id, function (err, job) {
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

            self.jobBackend.create(cdbUsername, sql, userDatabase.host, function (err, result) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    job: result,
                    host: userDatabase.host
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
