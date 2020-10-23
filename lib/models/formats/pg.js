'use strict';

var step = require('step');
var PSQL = require('cartodb-psql');

function PostgresFormat (id) {
    this.id = id;
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

    this.start_time = Date.now();

    this.client = new PSQL(opts.dbopts);
    this.client.eventedQuery(sql, function (err, query, queryCanceller) {
        that.queryCanceller = queryCanceller;
        if (err) {
            callback(err);
            return;
        }
        if (that.opts.profiler) {
            that.opts.profiler.done('eventedQuery');
        }

        if (that.hasSkipFields) {
            query.on('row', that.handleQueryRowWithSkipFields.bind(that));
        } else {
            query.on('row', that.handleQueryRow.bind(that));
        }
        query.on('end', that.handleQueryEnd.bind(that));
        query.on('error', function (err) {
            that.error = err;
            if (err.message && err.message.match(/row too large, was \d* bytes/i)) {
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
    });
};

PostgresFormat.prototype.cancel = function () {
    if (this.queryCanceller) {
        this.queryCanceller.call();
    }
};

module.exports = PostgresFormat;
