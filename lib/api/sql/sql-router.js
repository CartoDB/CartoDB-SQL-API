'use strict';

const { Router: router } = require('express');

const UserDatabaseService = require('../../services/user-database-service');
const UserLimitsService = require('../../services/user-limits');

const socketTimeout = require('../middlewares/socket-timeout');
const cors = require('../middlewares/cors');
const servedByHostHeader = require('../middlewares/served-by-host-header');
const clientHeader = require('../middlewares/client-header');

const QueryController = require('./query-controller');
const CopyController = require('./copy-controller');
const JobController = require('./job-controller');

module.exports = class SqlRouter {
    constructor ({ metadataBackend, statsClient, logger, jobService }) {
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
            userLimitsService,
            logger
        );

        this.copyController = new CopyController(
            metadataBackend,
            userDatabaseService,
            statsClient,
            userLimitsService,
            logger
        );

        this.jobController = new JobController(
            metadataBackend,
            userDatabaseService,
            jobService,
            statsClient,
            userLimitsService,
            logger
        );
    }

    route (apiRouter, routes) {
        routes.forEach(route => {
            const sqlRouter = router({ mergeParams: true });

            const paths = route.paths;
            const middlewares = route.middlewares || [];

            middlewares.forEach(middleware => sqlRouter.use(middleware()));

            sqlRouter.use(socketTimeout());
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
