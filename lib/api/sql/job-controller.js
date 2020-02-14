'use strict';

const util = require('util');

const bodyParser = require('../middlewares/body-parser');
const user = require('../middlewares/user');
const { initializeProfiler, finishProfiler } = require('../middlewares/profiler');
const authorization = require('../middlewares/authorization');
const connectionParams = require('../middlewares/connection-params');
const rateLimits = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimits;
const params = require('../middlewares/params');
const log = require('../middlewares/log');

module.exports = class JobController {
    constructor (metadataBackend, userDatabaseService, jobService, statsdClient, userLimitsService) {
        this.metadataBackend = metadataBackend;
        this.userDatabaseService = userDatabaseService;
        this.jobService = jobService;
        this.statsdClient = statsdClient;
        this.userLimitsService = userLimitsService;
    }

    route (sqlRouter) {
        const jobMiddlewares = composeJobMiddlewares(
            this.metadataBackend,
            this.userDatabaseService,
            this.jobService,
            this.statsdClient,
            this.userLimitsService
        );

        sqlRouter.post('/job', [
            bodyParser(),
            checkBodyPayloadSize(),
            params({ strategy: 'job' }),
            log(log.TYPES.JOB),
            jobMiddlewares('create', createJob, RATE_LIMIT_ENDPOINTS_GROUPS.JOB_CREATE)
        ]);

        sqlRouter.get('/job/:job_id', [
            bodyParser(),
            jobMiddlewares('retrieve', getJob, RATE_LIMIT_ENDPOINTS_GROUPS.JOB_GET)
        ]);

        sqlRouter.delete('/job/:job_id', [
            bodyParser(),
            jobMiddlewares('cancel', cancelJob, RATE_LIMIT_ENDPOINTS_GROUPS.JOB_DELETE)
        ]);
    }
};

function composeJobMiddlewares (metadataBackend, userDatabaseService, jobService, statsdClient, userLimitsService) {
    return function jobMiddlewares (action, job, endpointGroup) {
        const forceToBeMaster = true;

        return [
            initializeProfiler('job'),
            user(metadataBackend),
            rateLimits(userLimitsService, endpointGroup),
            authorization(metadataBackend, forceToBeMaster),
            connectionParams(userDatabaseService),
            job(jobService),
            setServedByDBHostHeader(),
            finishProfiler(),
            logJobResult(action),
            incrementSuccessMetrics(statsdClient),
            sendResponse(),
            incrementErrorMetrics(statsdClient)
        ];
    };
}

function cancelJob (jobService) {
    return function cancelJobMiddleware (req, res, next) {
        const { job_id: jobId } = req.params;

        jobService.cancel(jobId, (err, job) => {
            if (req.profiler) {
                req.profiler.done('cancelJob');
            }

            if (err) {
                return next(err);
            }

            res.body = job.serialize();

            next();
        });
    };
}

function getJob (jobService) {
    return function getJobMiddleware (req, res, next) {
        const { job_id: jobId } = req.params;

        jobService.get(jobId, (err, job) => {
            if (req.profiler) {
                req.profiler.done('getJob');
            }

            if (err) {
                return next(err);
            }

            res.body = job.serialize();

            next();
        });
    };
}

function createJob (jobService) {
    return function createJobMiddleware (req, res, next) {
        var data = {
            user: res.locals.user,
            query: res.locals.params.sql,
            host: res.locals.userDbParams.host,
            port: global.settings.db_batch_port || res.locals.userDbParams.port,
            pass: res.locals.userDbParams.pass,
            dbname: res.locals.userDbParams.dbname,
            dbuser: res.locals.userDbParams.user
        };

        jobService.create(data, (err, job) => {
            if (req.profiler) {
                req.profiler.done('createJob');
            }

            if (err) {
                return next(err);
            }

            res.locals.job_id = job.job_id;

            res.statusCode = 201;
            res.body = job.serialize();

            next();
        });
    };
}

function checkBodyPayloadSize () {
    return function checkBodyPayloadSizeMiddleware (req, res, next) {
        const payload = JSON.stringify(req.body);

        if (payload.length > MAX_LIMIT_QUERY_SIZE_IN_BYTES) {
            return next(new Error(getMaxSizeErrorMessage(payload)), res);
        }

        next();
    };
}

const ONE_KILOBYTE_IN_BYTES = 1024;
const MAX_LIMIT_QUERY_SIZE_IN_KB = 16;
const MAX_LIMIT_QUERY_SIZE_IN_BYTES = MAX_LIMIT_QUERY_SIZE_IN_KB * ONE_KILOBYTE_IN_BYTES;

function getMaxSizeErrorMessage (sql) {
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

module.exports.MAX_LIMIT_QUERY_SIZE_IN_BYTES = MAX_LIMIT_QUERY_SIZE_IN_BYTES;
module.exports.getMaxSizeErrorMessage = getMaxSizeErrorMessage;

function setServedByDBHostHeader () {
    return function setServedByDBHostHeaderMiddleware (req, res, next) {
        const { userDbParams } = res.locals;

        if (userDbParams.host) {
            res.header('X-Served-By-DB-Host', res.locals.userDbParams.host);
        }

        next();
    };
}

function logJobResult (action) {
    return function logJobResultMiddleware (req, res, next) {
        if (process.env.NODE_ENV !== 'test') {
            console.info(JSON.stringify({
                type: 'sql_api_batch_job',
                username: res.locals.user,
                action: action,
                job_id: req.params.job_id || res.locals.job_id
            }));
        }

        next();
    };
}

const METRICS_PREFIX = 'sqlapi.job';

function incrementSuccessMetrics (statsdClient) {
    return function incrementSuccessMetricsMiddleware (req, res, next) {
        if (statsdClient !== undefined) {
            statsdClient.increment(`${METRICS_PREFIX}.success`);
        }

        next();
    };
}

function incrementErrorMetrics (statsdClient) {
    return function incrementErrorMetricsMiddleware (err, req, res, next) {
        if (statsdClient !== undefined) {
            statsdClient.increment(`${METRICS_PREFIX}.error`);
        }

        next(err);
    };
}

function sendResponse () {
    return function sendResponseMiddleware (req, res, next) {
        res.status(res.statusCode || 200).send(res.body);

        next();
    };
}
