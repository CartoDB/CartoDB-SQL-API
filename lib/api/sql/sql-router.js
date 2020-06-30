'use strict';

const { Router: router } = require('express');

const UserDatabaseService = require('../../services/user-database-service');
const UserLimitsService = require('../../services/user-limits');

const socketTimeout = require('../middlewares/socket-timeout');
const initLogger = require('../middlewares/logger');
const profiler = require('../middlewares/profiler');
const cors = require('../middlewares/cors');
const servedByHostHeader = require('../middlewares/served-by-host-header');
const clientHeader = require('../middlewares/client-header');

const QueryController = require('./query-controller');
const CopyController = require('./copy-controller');
const JobController = require('./job-controller');

module.exports = class SqlRouter {
    constructor ({ metadataBackend, statsClient, logger, jobService }) {
        this.logger = logger;
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
            userLimitsService
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
            sqlRouter.use(initLogger({ logger: this.logger }));
            sqlRouter.use(profiler({ statsClient: this.statsClient }));
            sqlRouter.use(cors());
            sqlRouter.use(clientHeader());
            sqlRouter.use(servedByHostHeader());

            this.queryController.route(sqlRouter);
            this.copyController.route(sqlRouter);
            this.jobController.route(sqlRouter);

            paths.forEach(path => apiRouter.use(path, sqlRouter));
        });
    }
};
