const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const StreamCopyMetrics = require('./stream_copy_metrics');
const { Client } = require('pg');
const Logger = require('./logger');

module.exports = class StreamCopy {
    constructor() {
        this.logger = new Logger(global.settings.dataIngestionLogPath, 'data-ingestion');
    }

    to(res, sql, userDbParams, user, cb) {
        
    }

    from(req, sql, userDbParams, user, gzip, cb) {
        
    }
};
