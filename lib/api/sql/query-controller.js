'use strict';

const initLogger = require('../middlewares/logger');
const logReqRes = require('../middlewares/log-req-res');
const profiler = require('../middlewares/profiler');
const bodyParser = require('../middlewares/body-parser');
const user = require('../middlewares/user');
const rateLimits = require('../middlewares/rate-limit');
const authorization = require('../middlewares/authorization');
const connectionParams = require('../middlewares/connection-params');
const timeoutLimits = require('../middlewares/timeout-limits');
const params = require('../middlewares/params');
const logQuery = require('../middlewares/log-query');
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
const tag = require('../middlewares/tag');

const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimits;
const PSQL = require('cartodb-psql');

module.exports = class QueryController {
    constructor ({ metadataBackend, userDatabaseService, statsdClient, userLimitsService, logger }) {
        this.metadataBackend = metadataBackend;
        this.statsdClient = statsdClient;
        this.userDatabaseService = userDatabaseService;
        this.userLimitsService = userLimitsService;
        this.logger = logger;
    }

    route (sqlRouter) {
        const forceToBeMaster = false;

        const queryMiddlewares = () => {
            return [
                initLogger({ logger: this.logger }),
                user(this.metadataBackend),
                logReqRes(),
                profiler({ statsClient: this.statsdClient }),
                tag({ tags: ['query'] }),
                bodyParser(),
                rateLimits(this.userLimitsService, RATE_LIMIT_ENDPOINTS_GROUPS.QUERY),
                authorization(this.metadataBackend, forceToBeMaster),
                connectionParams(this.userDatabaseService),
                timeoutLimits(this.metadataBackend),
                params({ strategy: 'query' }),
                logQuery(),
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
                handleQuery({ stats: this.statsdClient })
            ];
        };

        sqlRouter.all('/', queryMiddlewares());
        sqlRouter.all('.:f', queryMiddlewares());
    }
};

function handleQuery ({ stats } = {}) {
    return function handleQueryMiddleware (req, res, next) {
        const { user: username, userDbParams: dbopts, userLimits } = res.locals;
        const { orderBy, sortOrder, limit, offset } = res.locals.params;
        const { sql, skipfields, decimalPrecision, filename, callback } = res.locals.params;

        let { formatter } = req;

        try {
            req.profiler.done('init');

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
                };
            }

            if (dbopts.host) {
                res.header('X-Served-By-DB-Host', dbopts.host);
            }

            formatter.sendResponse(opts, (err) => {
                formatter = null;

                if (stats) {
                    if (err) {
                        stats.increment('sqlapi.query.error');
                    } else {
                        stats.increment('sqlapi.query.success');
                    }
                }

                if (err) {
                    next(err);
                } else {
                    next();
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
