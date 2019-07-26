'use strict';

const PSQL = require('cartodb-psql');
const bodyParserMiddleware = require('../middlewares/body-parser');
const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const parameters = require('../middlewares/parameters');
const logMiddleware = require('../middlewares/log');
const cancelOnClientAbort = require('../middlewares/cancel-on-client-abort');
const affectedTables = require('../middlewares/affected-tables');
const accessValidator = require('../middlewares/access-validator');
const queryMayWrite = require('../middlewares/query-may-write');
const cacheControl = require('../middlewares/cache-control');
const cacheChannel = require('../middlewares/cache-channel');
const surrogateKey = require('../middlewares/surrogate-key');
const lastModified = require('../middlewares/last-modified');
const formatter = require('../middlewares/formatter');
const content = require('../middlewares/content');

module.exports = class QueryController {
    constructor (metadataBackend, userDatabaseService, statsdClient, userLimitsService) {
        this.metadataBackend = metadataBackend;
        this.stats = statsdClient;
        this.userDatabaseService = userDatabaseService;
        this.userLimitsService = userLimitsService;
    }

    route (app) {
        const { base_url } = global.settings;
        const forceToBeMaster = false;

        const queryMiddlewares = () => {
            return [
                bodyParserMiddleware(),
                initializeProfilerMiddleware('query'),
                userMiddleware(this.metadataBackend),
                rateLimitsMiddleware(this.userLimitsService, RATE_LIMIT_ENDPOINTS_GROUPS.QUERY),
                authorizationMiddleware(this.metadataBackend, forceToBeMaster),
                connectionParamsMiddleware(this.userDatabaseService),
                timeoutLimitsMiddleware(this.metadataBackend),
                parameters({ strategy: 'query' }),
                logMiddleware(logMiddleware.TYPES.QUERY),
                cancelOnClientAbort(),
                affectedTables(),
                accessValidator(),
                queryMayWrite(),
                cacheControl(),
                cacheChannel(),
                surrogateKey(),
                lastModified(),
                formatter(),
                content(),
                handleQuery({ stats: this.stats }),
                errorMiddleware()
            ];
        };

        app.all(`${base_url}/sql`, queryMiddlewares());
        app.all(`${base_url}/sql.:f`, queryMiddlewares());
    }
};

function handleQuery ({ stats } = {}) {
    return function handleQueryMiddleware (req, res, next) {
        const { user: username, userDbParams: dbopts, userLimits } = res.locals;
        const { orderBy, sortOrder, limit, offset } = res.locals.params;
        const { sql, skipfields, decimalPrecision, filename, callback } = res.locals.params;

        let { formatter } = req;

        try {
            if (req.profiler) {
                req.profiler.done('init');
            }

            const opts = {
                username: username,
                dbopts: dbopts,
                sink: res,
                gn: 'the_geom', // TODO: read from configuration FILE,
                dp: decimalPrecision,
                skipfields: skipfields,
                sql: new PSQL.QueryWrapper(sql).orderBy(orderBy, sortOrder).window(limit, offset).query(),
                filename: filename,
                bufferedRows: global.settings.bufferedRows,
                callback: callback,
                timeout: userLimits.timeout
            };

            if (req.profiler) {
                opts.profiler = req.profiler;
                opts.beforeSink = function () {
                    req.profiler.done('beforeSink');
                    res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
                };
            }

            if (dbopts.host) {
                res.header('X-Served-By-DB-Host', dbopts.host);
            }

            formatter.sendResponse(opts, (err) => {
                formatter = null;

                if (err) {
                    next(err);
                }

                if (req.profiler) {
                    req.profiler.sendStats();
                }

                if (stats) {
                    if (err) {
                        stats.increment('sqlapi.query.error');
                    } else {
                        stats.increment('sqlapi.query.success');
                    }
                }

            });
        } catch (err) {
            next(err);

            if (stats) {
                stats.increment('sqlapi.query.error');
            }
        }
    };
}
