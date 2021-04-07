'use strict';

const debug = require('debug')('>');
debug.enabled = true;
const { promisify } = require('util');
const RedisPool = require('redis-mpool');
const cartodbRedis = require('cartodb-redis');
const env = process.env.NODE_ENV || 'development';
const config = require(`../../config/environments/${env}`);

debug(`using "${env}" environment`);
debug(`redis "${config.redis_host}:${config.redis_port}"`);

const redisPool = new RedisPool({
    name: 'remove-old-batch-jobs',
    host: config.redis_host,
    port: config.redis_port,
    max: config.redisPool,
    idleTimeoutMillis: config.redisIdleTimeoutMillis,
    reapIntervalMillis: config.redisReapIntervalMillis
});
const metadata = cartodbRedis({ pool: redisPool });
const JOBS = {
    DB: global.settings.batch_db || 5,
    PREFIX: 'batch:jobs'
};

const TWO_DAYS_IN_MILLISECONDS = 48 * 3600 * 1000;

async function redisCmd (db, command, params) {
    const cmd = promisify(metadata.redisCmd.bind(metadata));
    const result = await cmd(db, command, params);

    return result;
}

async function scan () {
    const jobs = [];
    const initialCursor = '0';

    return _scan(initialCursor, jobs);
};

async function _scan (cursor, jobs) {
    const redisParams = [cursor, 'MATCH', `${JOBS.PREFIX}:*`];
    const [_cursor, _jobs] = await redisCmd(JOBS.DB, 'SCAN', redisParams);

    if (_jobs && _jobs.length) {
        jobs = jobs.concat(_jobs);
    }

    if (_cursor === '0') {
        return jobs;
    }

    return _scan(_cursor, jobs);
}

async function getJob (key) {
    const props = [
        'user',
        'status',
        'created_at',
        'updated_at'
    ];

    const redisParams = [`${key}`, ...props];

    const values = await redisCmd(JOBS.DB, 'HMGET', redisParams);

    const job = {};
    for (const [i, v] of values.entries()) {
        job[props[i]] = v;
    }

    return job;
}

async function removeJob (key) {
    const redisParams = [key];

    const done = await redisCmd(JOBS.DB, 'DEL', redisParams);

    return done;
}

async function main () {
    const summary = {
        found: 0,
        removed: 0
    };
    try {
        debug('going to scan jobs');
        const jobKeys = await scan();

        summary.found = jobKeys.length;
        debug(`found "${jobKeys.length}" jobs`);
        debug('--------------------------------------------------');

        for (const key of jobKeys) {
            debug(`fetching job "${key}"`);
            const job = await getJob(key);

            debug(`job "${key}" found (user:${job.user}, status: ${job.status}, created_at: ${job.created_at}, updated_at: ${job.updated_at})`);

            const updatedAt = new Date(job.updated_at).getTime();
            const now = Date.now();
            const elapsed = now - updatedAt;

            if (elapsed > TWO_DAYS_IN_MILLISECONDS) {
                debug(`job ${key} is older than two days, removing it`);
                const removed = await removeJob(key);
                debug(removed ? `job "${key}" removed` : `job "${key}" was not removed`);
                summary.removed += removed ? 1 : 0;
            } else {
                debug(`job "${key}" is younger than two days, keeping it`);
            }

            debug('--------------------------------------------------');
        }

        debug('summary:', summary);
        debug('done');
    } catch (err) {
        debug(err);
    }
}

main().then(() => process.exit(0));
