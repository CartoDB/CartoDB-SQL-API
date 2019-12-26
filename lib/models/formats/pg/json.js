'use strict';

var _ = require('underscore');

var Pg = require('./../pg');
const errorHandlerFactory = require('../../../services/error-handler-factory');

function JsonFormat () {
    this.buffer = '';
    this.lastKnownResult = {};
}

JsonFormat.prototype = new Pg('json');

JsonFormat.prototype._contentType = 'application/json; charset=utf-8';

JsonFormat.prototype.formatResultFields = function (flds) {
    flds = flds || [];
    var nfields = {};
    for (var i = 0; i < flds.length; ++i) {
        var f = flds[i];
        var cname = this.client.typeName(f.dataTypeID);
        var tname;

        if (!cname) {
            tname = 'unknown(' + f.dataTypeID + ')';
        } else {
            if (cname.match('bool')) {
                tname = 'boolean';
            } else if (cname.match(/int|float|numeric/)) {
                tname = 'number';
            } else if (cname.match(/text|char|unknown/)) {
                tname = 'string';
            } else if (cname.match(/date|time/)) {
                tname = 'date';
            } else {
                tname = cname;
            }
            if (tname && cname.match(/^_/)) {
                tname += '[]';
            }
        }

        if (['geography', 'geometry', 'raster'].includes(cname)) {
            const { wkbtype, ndims, srid } = this.client.typeModInfo(f.dataTypeModifier);
            nfields[f.name] = { type: tname, wkbtype, dims: ndims, srid };
        } else {
            nfields[f.name] = { type: tname, pgtype: cname };
        }
    }
    return nfields;
};

JsonFormat.prototype.startStreaming = function () {
    this.total_rows = 0;
    if (this.opts.beforeSink) {
        this.opts.beforeSink();
    }
    if (this.opts.callback) {
        this.buffer += this.opts.callback + '(';
    }
    this.buffer += '{"rows":[';
    this._streamingStarted = true;
};

JsonFormat.prototype.handleQueryRow = function (row, result) {
    if (!this._streamingStarted) {
        this.startStreaming();
    }

    this.lastKnownResult = result;

    this.buffer += (this.total_rows++ ? ',' : '') + JSON.stringify(row, function (key, value) {
        if (value !== value) { // eslint-disable-line no-self-compare
            return 'NaN';
        }

        if (value === Infinity) {
            return 'Infinity';
        }

        if (value === -Infinity) {
            return '-Infinity';
        }

        return value;
    });

    if (this.total_rows % (this.opts.bufferedRows || 1000)) {
        this.opts.sink.write(this.buffer);
        this.buffer = '';
    }
};

JsonFormat.prototype.handleQueryEnd = function (result) {
    if (this.error && !this._streamingStarted) {
        this.callback(this.error);
        return;
    }

    if (this.opts.profiler) {
        this.opts.profiler.done('gotRows');
    }

    if (!this._streamingStarted) {
        this.startStreaming();
    }

    this.opts.total_time = (Date.now() - this.start_time) / 1000;

    result = result || this.lastKnownResult || {};

    // Drop field description for skipped fields
    if (this.hasSkipFields) {
        var newfields = [];
        var sf = this.opts.skipfields;
        for (var i = 0; i < result.fields.length; i++) {
            var f = result.fields[i];
            if (sf.indexOf(f.name) === -1) {
                newfields.push(f);
            }
        }
        result.fields = newfields;
    }

    var totalTime = (Date.now() - this.start_time) / 1000;

    var out = [
        '],', // end of "rows" array
        '"time":', JSON.stringify(totalTime),
        ',"fields":', JSON.stringify(this.formatResultFields(result.fields)),
        ',"total_rows":', JSON.stringify(result.rowCount || this.total_rows)
    ];

    if (this.error) {
        out.push(',"error":', JSON.stringify(errorHandlerFactory(this.error).getResponse().error));
    }

    if (result.notices && result.notices.length > 0) {
        var notices = {};
        var severities = [];
        _.each(result.notices, function (notice) {
            var severity = notice.severity.toLowerCase() + 's';
            if (!notices[severity]) {
                severities.push(severity);
                notices[severity] = [];
            }
            notices[severity].push(notice.message);
        });
        _.each(severities, function (severity) {
            out.push(',');
            out.push(JSON.stringify(severity));
            out.push(':');
            out.push(JSON.stringify(notices[severity]));
        });
    }

    out.push('}');

    this.buffer += out.join('');

    if (this.opts.callback) {
        this.buffer += ')';
    }

    this.opts.sink.write(this.buffer);
    this.opts.sink.end();
    this.buffer = '';

    this.callback();
};

module.exports = JsonFormat;
