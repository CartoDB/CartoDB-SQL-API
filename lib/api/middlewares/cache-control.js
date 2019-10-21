'use strict';

const ONE_MINUTE_IN_SECONDS = 60;
const THREE_MINUTE_IN_SECONDS = 60 * 3;
const FIVE_MINUTES_IN_SECONDS = ONE_MINUTE_IN_SECONDS * 5;
const TEN_MINUTES_IN_SECONDS = ONE_MINUTE_IN_SECONDS * 10;
const FIFTEEN_MINUTES_IN_SECONDS = ONE_MINUTE_IN_SECONDS * 15;
const THIRTY_MINUTES_IN_SECONDS = ONE_MINUTE_IN_SECONDS * 30;
const ONE_HOUR_IN_SECONDS = ONE_MINUTE_IN_SECONDS * 60;
const ONE_YEAR_IN_SECONDS = ONE_HOUR_IN_SECONDS * 24 * 365;

const defaultCacheTTL = {
    ttl: ONE_YEAR_IN_SECONDS,
    fallbackTtl: FIVE_MINUTES_IN_SECONDS
};

const validFallbackTTL = [
    ONE_MINUTE_IN_SECONDS,
    THREE_MINUTE_IN_SECONDS,
    FIVE_MINUTES_IN_SECONDS,
    TEN_MINUTES_IN_SECONDS,
    FIFTEEN_MINUTES_IN_SECONDS,
    THIRTY_MINUTES_IN_SECONDS,
    ONE_HOUR_IN_SECONDS
];

const { ttl, fallbackTtl } = Object.assign(defaultCacheTTL, global.settings.cache);

module.exports = function cacheControlHeader () {
    if (!validFallbackTTL.includes(fallbackTtl)) {
        const message = [
            'Invalid fallback TTL value for Cache-Control header.',
            `Got ${fallbackTtl}, expected ${validFallbackTTL.join(', ')}`
        ].join(' ');

        throw new Error(message);
    }

    return function cacheControlHeaderMiddleware (req, res, next) {
        const { cachePolicy } = res.locals.params;
        const { affectedTables, mayWrite } = res.locals;

        if (cachePolicy === 'persist') {
            res.header('Cache-Control', `public,max-age=${ONE_YEAR_IN_SECONDS}`);

            return next();
        }

        if (affectedTables && affectedTables.getTables().every(table => table.updated_at !== null)) {
            const maxAge = mayWrite ? 0 : ttl;
            res.header('Cache-Control', `no-cache,max-age=${maxAge},must-revalidate,public`);

            return next();
        }

        const maxAge = fallbackTtl;
        res.header(
            'Cache-Control',
            `no-cache,max-age=${computeNextTTL({ ttlInSeconds: maxAge })},must-revalidate,public`
        );

        return next();
    };
};

function computeNextTTL ({ ttlInSeconds } = {}) {
    const nowInSeconds = Math.ceil(Date.now() / 1000);
    const secondsAfterPreviousTTLStep = nowInSeconds % ttlInSeconds;
    const secondsToReachTheNextTTLStep = ttlInSeconds - secondsAfterPreviousTTLStep;

    return secondsToReachTheNextTTLStep;
}
