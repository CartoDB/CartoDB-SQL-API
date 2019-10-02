'use strict';

const { Router: router } = require('express');

const SqlRouter = require('./sql-router');

const HealthCheckController = require('./health_check_controller');
const VersionController = require('./version_controller');
const JobsWipController = require('./jobs_wip_controller');

const BatchLogger = require('../../batch/batch-logger');

const JobPublisher = require('../../batch/pubsub/job-publisher');
const JobQueue = require('../../batch/job_queue');
const JobBackend = require('../../batch/job_backend');
const JobCanceller = require('../../batch/job_canceller');
const JobService = require('../../batch/job_service');

module.exports = class ApiRouter {
    constructor ({ redisPool, metadataBackend, statsClient, dataIngestionLogger }) {
        const logger = new BatchLogger(global.settings.batch_log_filename, 'batch-queries');
        const jobPublisher = new JobPublisher(redisPool);
        const jobQueue = new JobQueue(metadataBackend, jobPublisher, logger);
        const jobBackend = new JobBackend(metadataBackend, jobQueue, logger);
        const jobCanceller = new JobCanceller();
        const jobService = new JobService(jobBackend, jobCanceller, logger);

        this.healthCheckController = new HealthCheckController();
        this.versionController = new VersionController();
        this.jobsWipController = new JobsWipController({ jobService });

        this.sqlRouter = new SqlRouter({
            metadataBackend,
            statsClient,
            dataIngestionLogger,
            jobService
        });
    }

    route (app, routes) {
        routes.forEach(route => {
            const apiRouter = router({ mergeParams: true });

            const paths = route.paths;
            const middlewares = route.middlewares || [];

            middlewares.forEach(middleware => apiRouter.use(middleware()));

            // FIXME: version controller should be atached to the main entry point: "/"
            // instead of "/api/:version" or "/user/:user/api/:version"
            this.healthCheckController.route(apiRouter);

            // FIXME: version controller should be atached to the main entry point: "/"
            // instead of "/api/:version" or "/user/:user/api/:version"
            this.versionController.route(apiRouter);

            this.jobsWipController.route(apiRouter);

            this.sqlRouter.route(apiRouter, route.sql);

            paths.forEach(path => app.use(path, apiRouter));
        });
    }
};
