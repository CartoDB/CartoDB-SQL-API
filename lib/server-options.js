'use strict';

const Logger = require('./utils/logger');
const logger = new Logger();

module.exports = function getServerOptions () {
    const defaults = {
        routes: {
            // Each entry corresponds with an express' router.
            // You must define at least one path. However, middlewares are optional.
            api: [{
                // Required: path where other "routers" or "controllers" will be attached to.
                paths: [
                    // In case the path has a :user param the username will be the one specified in the URL,
                    // otherwise it will fallback to extract the username from the host header.
                    '/api/:version',
                    '/user/:user/api/:version'
                ],
                // Optional: attach middlewares at the begining of the router
                // to perform custom operations.
                middlewares: [],
                sql: [{
                    // Required
                    paths: [
                        '/sql'
                    ],
                    // Optional
                    middlewares: []
                }]
            }]
        },
        logger
    };

    return Object.assign({}, defaults, global.settings);
};
