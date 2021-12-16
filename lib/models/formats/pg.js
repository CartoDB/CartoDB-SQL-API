'use strict';

var step = require('step');
var PSQL = require('cartodb-psql');

const serverOptions = require('../../server-options');
const { logger } = serverOptions();

function PostgresFormat (id) {
    this.id = id;
    this.useCursor = false;
}

PostgresFormat.prototype = {

    getQuery: function (sql/*, options */) {
        return sql;
    },

    getContentType: function () {
        return this._contentType;
    },

    getFileExtension: function () {
        return this.id;
    }

};

PostgresFormat.prototype.handleQueryRow = function (row, result) {
    result.addRow(row);
};

PostgresFormat.prototype.handleQueryRowWithSkipFields = function (row, result) {
    var sf = this.opts.skipfields;
    for (var j = 0; j < sf.length; ++j) {
        delete row[sf[j]];
    }
    this.handleQueryRow(row, result);
};

PostgresFormat.prototype.handleNotice = function (msg, result) {
    if (!result.notices) {
        result.notices = [];
    }
    for (var i = 0; i < msg.length; i++) {
        result.notices.push(msg[i]);
    }
};

PostgresFormat.prototype.handleQueryEnd = function (result) {
    this.queryCanceller = undefined;

    if (this.error) {
        this.callback(this.error);
        return;
    }

    if (this.opts.profiler) {
        this.opts.profiler.done('gotRows');
    }

    this.opts.total_time = (Date.now() - this.start_time) / 1000;

    // Drop field description for skipped fields
    if (this.hasSkipFields) {
        var sf = this.opts.skipfields;
        var newfields = [];
        for (var j = 0; j < result.fields.length; ++j) {
            var f = result.fields[j];
            if (sf.indexOf(f.name) === -1) {
                newfields.push(f);
            }
        }
        result.fields = newfields;
    }

    var that = this;

    step(
        function packageResult () {
            that.transform(result, that.opts, this);
        },
        function sendResults (err, out) {
            if (err) {
                throw err;
            }

            // return to browser
            if (out) {
                if (that.opts.beforeSink) {
                    that.opts.beforeSink();
                }
                that.opts.sink.send(out);
            } else {
                console.error('No output from transform, doing nothing ?!');
            }
        },
        function errorHandle (err) {
            that.callback(err);
        }
    );
};

PostgresFormat.prototype.sendResponse = function (opts, callback) {
    if (this.callback) {
        callback(new Error('Invalid double call to .sendResponse on a pg formatter'));
        return;
    }
    this.callback = callback;
    this.opts = opts;

    this.hasSkipFields = opts.skipfields.length;

    var sql = this.getQuery(opts.sql, {
        gn: opts.gn,
        dp: opts.dp,
        skipfields: opts.skipfields
    });

    var that = this;

    var CHECK_BUFFER_INTERVAL = 20; // ms

    this.start_time = Date.now();

    this.client = new PSQL(opts.dbopts);
    this.client.eventedQuery(sql, this.useCursor, function (err, query, queryCanceller) {
        that.query = query
        that.queryCanceller = queryCanceller;
        if (err) {
            callback(err);
            return;
        }
        if (that.opts.profiler) {
            that.opts.profiler.done('eventedQuery');
        }

        query.on('error', function (err) {
            logger.info({ errorMessage: err.message }, 'Error during download');
            that.error = err;
            if (err.message && err.message.match(/row too large, was \d* bytes/i)) {
                that.maxRowSizeError = true;
                console.error(JSON.stringify({
                    username: opts.username,
                    type: 'row_size_limit_exceeded',
                    error: err.message
                }));
            }
            that.handleQueryEnd();
        });
        query.on('notice', function (msg) {
            that.handleNotice(msg, query._result);
        });

        // NOTE: Legacy mode
        if (!that.useCursor) {
            if (that.hasSkipFields) {
                query.on('row', that.handleQueryRowWithSkipFields.bind(that));
            } else {
                query.on('row', that.handleQueryRow.bind(that));
            }
            query.on('end', that.handleQueryEnd.bind(that));
            return;
        }

        // NOTE: Loop logic using a cursor
        that.opts.sink.on('drain', function () {
            // NOTE: This event is triggered when there is room for more rows (output buffer was flushed)
            that.waitingFlush = false;
        });

        var checkBuffer = function () {
            that.waitingFlush ? setTimeout(checkBuffer, CHECK_BUFFER_INTERVAL) : readNextRows();
        };

        var readNextRows = function () {
            that.query.read(global.settings.bufferedRows, function (_error, rows, result) {
                that.waitingFlush = false;

                if (rows === undefined) return;
                if (rows.length === 0) {
                    that.handleQueryEnd(result);
                    return;
                }

                rows.forEach(function (row) {
                    if (that.hasSkipFields) {
                        that.handleQueryRowWithSkipFields(row, result);
                    } else {
                        that.handleQueryRow(row, result);
                    }
                });

                checkBuffer();
            });
        };

        readNextRows();
    });
};

PostgresFormat.prototype.cancel = function () {
    if (this.queryCanceller) {
        this.queryCanceller.call();
    }
};

module.exports = PostgresFormat;
