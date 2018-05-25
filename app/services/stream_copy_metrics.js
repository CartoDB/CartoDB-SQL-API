const { getFormatFromCopyQuery } = require('../utils/query_info');

module.exports = class StreamCopyMetrics {
    constructor(logger, type, sql, gzip = null) {
        this.logger = logger;

        this.type =  type;
        this.format = getFormatFromCopyQuery(sql);
        this.gzip = gzip;
        this.size = 0;
        this.rows = 0;

        this.startTime = Date.now();
        this.endTime;
        this.time;
    }

    addSize (size) {
        this.size += size;
    }

    end (rows = null) {
        this.rows = rows;
        this.endTime = Date.now();
        this.time = (this.endTime - this.startTime) / 1000;

        this.logger.info({
            type: this.type,
            format: this.format,
            gzip: this.gzip,
            size: this.size,
            rows: this.rows,
            time: this.time
        });
    }
}
