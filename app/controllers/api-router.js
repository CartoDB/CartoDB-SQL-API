'use strict';

const { Router: router } = require('express');

const UserDatabaseService = require('../services/user_database_service');
const UserLimitsService = require('../services/user_limits');

const BatchLogger = require('../../batch/batch-logger');

const JobPublisher = require('../../batch/pubsub/job-publisher');
const JobQueue = require('../../batch/job_queue');
const JobBackend = require('../../batch/job_backend');
const JobCanceller = require('../../batch/job_canceller');
const JobService = require('../../batch/job_service');

const QueryController = require('./query_controller');
const CopyController = require('./copy_controller');
const JobController = require('./job_controller');

const socketTimeout = require('../middlewares/socket-timeout');
const logger = require('../middlewares/logger');
const profiler = require('../middlewares/profiler');
const cors = require('../middlewares/cors');
const servedByHostHeader = require('../middlewares/served-by-host-header');

module.exports = class ApiRouter {
    constructor ({ routes, redisPool, metadataBackend, statsClient, dataIngestionLogger }) {
        this.routes = routes;
        this.statsClient = statsClient;

        const userLimitsServiceOptions = {
            limits: {
                rateLimitsEnabled: global.settings.ratelimits.rateLimitsEnabled
            }
        };

        const userDatabaseService = new UserDatabaseService(metadataBackend);
        const userLimitsService = new UserLimitsService(metadataBackend, userLimitsServiceOptions);

        this.queryController = new QueryController(
            metadataBackend,
            userDatabaseService,
            statsClient,
            userLimitsService
        );

        this.copyController = new CopyController(
            metadataBackend,
            userDatabaseService,
            userLimitsService,
            dataIngestionLogger
        );

        const logger = new BatchLogger(global.settings.batch_log_filename, 'batch-queries');
        const jobPublisher = new JobPublisher(redisPool);
        const jobQueue = new JobQueue(metadataBackend, jobPublisher, logger);
        const jobBackend = new JobBackend(metadataBackend, jobQueue, logger);
        const jobCanceller = new JobCanceller();
        const jobService = new JobService(jobBackend, jobCanceller, logger);

        this.jobController = new JobController(
            metadataBackend,
            userDatabaseService,
            jobService,
            statsClient,
            userLimitsService
        );
    }

    route (app) {
        const apiRouter = router({ mergeParams: true });
        const paths = this.routes.paths || [];
        const middlewares = this.routes.middlewares || [];

        middlewares.forEach(middleware => apiRouter.use(middleware()));

        apiRouter.use(socketTimeout());
        apiRouter.use(logger());
        apiRouter.use(profiler({ statsClient: this.statsClient }));
        apiRouter.use(cors());
        apiRouter.use(servedByHostHeader());

        this.queryController.route(apiRouter);
        this.copyController.route(apiRouter);
        this.jobController.route(apiRouter);

        paths.forEach(path => app.use(path, apiRouter));
    }
};
