'use strict';

var bunyan = require('bunyan');
var fs = require('fs');

var debug = require('./util/debug')('batch-logger');

var JobUtils = require('./models/job_state_machine');
var jobUtils = new JobUtils();
var JobFallback = require('./models/job_fallback');

function BatchLogger (path) {
    this.path = path;
    this.logger = bunyan.createLogger({
        name: 'batch-queries',
        streams: [{
            level: 'info',
            stream: path ? fs.createWriteStream(path, { flags: 'a', encoding: 'utf8' }) :  process.stdout
        }]
    });
}

module.exports = BatchLogger;

BatchLogger.prototype.log = function (job) {
    if (!isFinished(job)) {
        return;
    }

    var queries = job.data.query.query;

    for (var i = 0; i < queries.length; i++) {
        var query = queries[i];

        if (!query.id) {
            continue;
        }

        var node = parseQueryId(query.id);
        var output = {
            username: job.data.user,
            job: job.data.job_id,
            analysis: node.analysis,
            node: node.id,
            type: node.type,
            elapsedTime: calculateElpasedTime(query.started_at, query.ended_at)
        };

        debug('analysis %j', output);

        this.logger.info(output);
    }
};

function isFinished (job) {
    return job instanceof JobFallback &&
        jobUtils.isFinalStatus(job.data.status) &&
        (!job.data.fallback_status || jobUtils.isFinalStatus(job.data.fallback_status));
}

BatchLogger.prototype.reopenFileStreams = function () {
    this.logger.reopenFileStreams();
};

function parseQueryId (queryId) {
    var data = queryId.split(':');

    return {
        analysis: data[0],
        id: data[1],
        type: data[2]
    };
}

function calculateElpasedTime (started_at, ended_at) {
    if (!started_at || !ended_at) {
        return;
    }

    var start = new Date(started_at);
    var end = new Date(ended_at);
    var elapsedTimeMilliseconds = end.getTime() - start.getTime();

    return elapsedTimeMilliseconds;
}
