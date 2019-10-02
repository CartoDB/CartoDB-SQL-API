'use strict';

const { Router: router } = require('express');

const UserDatabaseService = require('../services/user_database_service');
const UserLimitsService = require('../services/user_limits');

const socketTimeout = require('../middlewares/socket-timeout');
const logger = require('../middlewares/logger');
const profiler = require('../middlewares/profiler');
const cors = require('../middlewares/cors');
const servedByHostHeader = require('../middlewares/served-by-host-header');

const QueryController = require('./query_controller');
const CopyController = require('./copy_controller');
const JobController = require('./job_controller');

module.exports = class SqlRouter {
    constructor ({ routes, metadataBackend, statsClient, dataIngestionLogger, jobService }) {
        this.routes = routes;

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

        this.jobController = new JobController(
            metadataBackend,
            userDatabaseService,
            jobService,
            statsClient,
            userLimitsService
        );
    }

    route (apiRouter, routes) {
        routes.forEach(route => {
            const sqlRouter = router({ mergeParams: true });

            const paths = route.paths;
            const middlewares = route.middlewares || [];

            middlewares.forEach(middleware => sqlRouter.use(middleware()));

            sqlRouter.use(socketTimeout());
            sqlRouter.use(logger());
            sqlRouter.use(profiler({ statsClient: this.statsClient }));
            sqlRouter.use(cors());
            sqlRouter.use(servedByHostHeader());

            this.queryController.route(sqlRouter);
            this.copyController.route(sqlRouter);
            this.jobController.route(sqlRouter);

            paths.forEach(path => apiRouter.use(path, sqlRouter));
        });
    }
};
