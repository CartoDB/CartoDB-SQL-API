'use strict';

const ONE_YEAR_IN_SECONDS = 31536000; // ttl in cache provider
const FIVE_MINUTES_IN_SECONDS = 60 * 5; // ttl in cache provider
const defaultCacheTTL = {
    ttl: ONE_YEAR_IN_SECONDS,
    fallbackTtl: FIVE_MINUTES_IN_SECONDS
};
const cacheControl = Object.assign(defaultCacheTTL, global.settings.cache);

module.exports = function cacheControlHeader () {
    return function cacheControlHeaderMiddleware (req, res, next) {
        const { cachePolicy } = res.locals.params;
        const { affectedTables, mayWrite } = res.locals;

        if (cachePolicy === 'persist') {
            res.header('Cache-Control', `public,max-age=${ONE_YEAR_IN_SECONDS}`);

            return next();
        }

        if (affectedTables && affectedTables.getTables().every(table => table.updated_at !== null)) {
            const maxAge = mayWrite ? 0 : cacheControl.ttl;
            res.header('Cache-Control', `no-cache,max-age=${maxAge},must-revalidate,public`);

            return next();
        }

        const maxAge = cacheControl.fallbackTtl;
        res.header('Cache-Control', `no-cache,max-age=${maxAge},must-revalidate,public`);

        return next();
    };
};
