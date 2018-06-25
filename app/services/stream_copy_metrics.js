const { getFormatFromCopyQuery } = require('../utils/query_info');

module.exports = class StreamCopyMetrics {
    constructor(logger, type, sql, user, gzip = null) {
        this.logger = logger;

        this.type = type;
        this.format = getFormatFromCopyQuery(sql);
        this.gzip = gzip;
        this.username = user;
        this.size = 0;
        this.gzipSize = 0;
        this.rows = 0;

        this.startTime = new Date();
        this.endTime = null;
        this.time = null;

        this.error = null;

        this.ended = false;
    }

    addSize(size) {
        this.size += size;
    }

    addGzipSize(size) {
        this.gzipSize += size;
    }

    end(rows = null, error = null) {
        if (this.ended) {
            return;
        }

        this.ended = true;

        if (Number.isInteger(rows)) {
            this.rows = rows;
        }

        if (error instanceof Error) {
            this.error = error;
        }

        this.endTime = new Date();
        this.time = (this.endTime.getTime() - this.startTime.getTime()) / 1000;

        this._log(
            this.startTime.toISOString(),
            this.gzip && this.gzipSize ? this.gzipSize : null,
            this.error ? this.error.message : null
        );
    }

    _log(timestamp, gzipSize = null, errorMessage = null) {
        let logData = {
            type: this.type,
            format: this.format,
            size: this.size,
            rows: this.rows,
            gzip: this.gzip,
            username: this.username,
            time: this.time,
            timestamp
        };

        if (gzipSize) {
            logData.gzipSize = gzipSize;
        }

        if (errorMessage) {
            logData.error = errorMessage;
        }

        this.logger.info(logData);
    }
};
