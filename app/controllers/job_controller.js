'use strict';

var _ = require('underscore');
var step = require('step');
var assert = require('assert');

var AuthApi = require('../auth/auth_api');
var CdbRequest = require('../models/cartodb_request');
var handleException = require('../utils/error_handler');
var cdbReq = new CdbRequest();

function JobController(userDatabaseService, jobBackend, jobCanceller) {
    this.userDatabaseService = userDatabaseService;
    this.jobBackend = jobBackend;
    this.jobCanceller = jobCanceller;
}

JobController.prototype.route = function (app) {
    app.post(global.settings.base_url + '/sql/job',  this.createJob.bind(this));
    app.get(global.settings.base_url + '/sql/job',  this.listJob.bind(this));
    app.get(global.settings.base_url + '/sql/job/:job_id',  this.getJob.bind(this));
    app.delete(global.settings.base_url + '/sql/job/:job_id',  this.cancelJob.bind(this));
    app.put(global.settings.base_url + '/sql/job/:job_id',  this.updateJob.bind(this));
    app.patch(global.settings.base_url + '/sql/job/:job_id',  this.updateJob.bind(this));
};

JobController.prototype.cancelJob = function (req, res) {
    var self = this;
    var job_id = req.params.job_id;
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var cdbUsername = cdbReq.userByReq(req);

    if ( req.profiler ) {
        req.profiler.start('sqlapi.job');
        req.profiler.done('init');
    }

    step(
        function getUserDBInfo() {
            var next = this;
            var authApi = new AuthApi(req, params);

            self.userDatabaseService.getConnectionParams(authApi, cdbUsername, next);
        },
        function cancelJob(err, userDatabase) {
            assert.ifError(err);

            if (!userDatabase.authenticated) {
                throw new Error('permission denied');
            }

            var next = this;

            if ( req.profiler ) {
                req.profiler.done('setDBAuth');
            }

            self.jobCanceller.cancel(job_id, function (err, job) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    job: job,
                    host: userDatabase.host
                });
            });
        },
        function handleResponse(err, result) {
            if ( err ) {
                return handleException(err, res);
            }

            if ( req.profiler ) {
                req.profiler.done('cancelJob');
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

JobController.prototype.listJob = function (req, res) {
    var self = this;
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var cdbUsername = cdbReq.userByReq(req);

    if ( req.profiler ) {
        req.profiler.start('sqlapi.job');
        req.profiler.done('init');
    }

    step(
        function getUserDBInfo() {
            var next = this;
            var authApi = new AuthApi(req, params);

            self.userDatabaseService.getConnectionParams(authApi, cdbUsername, next);
        },
        function listJob(err, userDatabase) {
            assert.ifError(err);

            if (!userDatabase.authenticated) {
                throw new Error('permission denied');
            }

            var next = this;

            if ( req.profiler ) {
                req.profiler.done('setDBAuth');
            }

            self.jobBackend.list(cdbUsername, function (err, jobs) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    jobs: jobs,
                    host: userDatabase.host
                });
            });
        },
        function handleResponse(err, result) {
            if ( err ) {
                return handleException(err, res);
            }

            if ( req.profiler ) {
                req.profiler.done('listJob');
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

    if ( req.profiler ) {
        req.profiler.start('sqlapi.job');
        req.profiler.done('init');
    }

    step(
        function getUserDBInfo() {
            var next = this;
            var authApi = new AuthApi(req, params);

            self.userDatabaseService.getConnectionParams(authApi, cdbUsername, next);
        },
        function getJob(err, userDatabase) {
            assert.ifError(err);

            if (!userDatabase.authenticated) {
                throw new Error('permission denied');
            }

            var next = this;

            if ( req.profiler ) {
                req.profiler.done('setDBAuth');
            }

            self.jobBackend.get(job_id, function (err, job) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    job: job,
                    host: userDatabase.host
                });
            });
        },
        function handleResponse(err, result) {
            if ( err ) {
                return handleException(err, res);
            }

            if ( req.profiler ) {
                req.profiler.done('getJob');
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
        req.profiler.done('init');
    }

    step(
        function getUserDBInfo() {
            var next = this;
            var authApi = new AuthApi(req, params);

            self.userDatabaseService.getConnectionParams(authApi, cdbUsername, next);
        },
        function persistJob(err, userDatabase) {
            assert.ifError(err);

            if (!userDatabase.authenticated) {
                throw new Error('permission denied');
            }

            var next = this;

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
                req.profiler.done('persistJob');
                res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
            }

            if (global.settings.api_hostname) {
                res.header('X-Served-By-Host', global.settings.api_hostname);
            }

            if (result.host) {
                res.header('X-Served-By-DB-Host', result.host);
            }

            res.status(201).send(result.job);
        }
    );
};


JobController.prototype.updateJob = function (req, res) {
    var self = this;
    var job_id = req.params.job_id;
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var sql = (params.query === "" || _.isUndefined(params.query)) ? null : params.query;
    var cdbUsername = cdbReq.userByReq(req);

    if (!_.isString(sql)) {
        return handleException(new Error("You must indicate a sql query"), res);
    }

    if ( req.profiler ) {
        req.profiler.start('sqlapi.job');
        req.profiler.done('init');
    }

    step(
        function getUserDBInfo() {
            var next = this;
            var authApi = new AuthApi(req, params);

            self.userDatabaseService.getConnectionParams(authApi, cdbUsername, next);
        },
        function updateJob(err, userDatabase) {
            assert.ifError(err);

            if (!userDatabase.authenticated) {
                throw new Error('permission denied');
            }

            var next = this;

            if ( req.profiler ) {
                req.profiler.done('setDBAuth');
            }

            self.jobBackend.update(job_id, sql, function (err, job) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    job: job,
                    host: userDatabase.host
                });
            });
        },
        function handleResponse(err, result) {
            if ( err ) {
                return handleException(err, res);
            }

            if ( req.profiler ) {
                req.profiler.done('updateJob');
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
