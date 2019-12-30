'use strict';

var _ = require('underscore');

var Pg = require('./../pg');
var ArrayBufferSer = require('../../bin-encoder');

function BinaryFormat () {}

BinaryFormat.prototype = new Pg('arraybuffer');

BinaryFormat.prototype._contentType = 'application/octet-stream';

BinaryFormat.prototype._extractTypeFromName = function (name) {
    var g = name.match(/.*__(uintclamp|uint|int|float)(8|16|32)/i);
    if (g && g.length === 3) {
        var typeName = g[1] + g[2];
        return ArrayBufferSer.typeNames[typeName];
    }
};

BinaryFormat.prototype.transform = function (result, options, callback) {
    var totalRows = result.rowCount;
    var rows = result.rows;

    // get headers
    if (!totalRows) {
        callback(null, Buffer.alloc(0));
        return;
    }

    var headersNames = Object.keys(rows[0]);
    var headerTypes = [];

    if (_.contains(headersNames, 'the_geom')) {
        callback(new Error('geometry types are not supported'), null);
        return;
    }

    try {
        var i;
        var r;
        var n;
        var t;
        // get header types (and guess from name)
        for (i = 0; i < headersNames.length; ++i) {
            r = rows[0];
            n = headersNames[i];
            if (typeof (r[n]) === 'string') {
                headerTypes.push(ArrayBufferSer.STRING);
            } else if (typeof (r[n]) === 'object') {
                t = this._extractTypeFromName(n);
                t = t || ArrayBufferSer.FLOAT32;
                headerTypes.push(ArrayBufferSer.BUFFER + t);
            } else {
                t = this._extractTypeFromName(n);
                headerTypes.push(t || ArrayBufferSer.FLOAT32);
            }
        }

        // pack the data
        var header = new ArrayBufferSer(ArrayBufferSer.STRING, headersNames);
        var data = [header];
        for (i = 0; i < headersNames.length; ++i) {
            var d = [];
            n = headersNames[i];
            for (r = 0; r < totalRows; ++r) {
                var row = rows[r][n];
                if (headerTypes[i] > ArrayBufferSer.BUFFER) {
                    row = new ArrayBufferSer(headerTypes[i] - ArrayBufferSer.BUFFER, row);
                }
                d.push(row);
            }
            var b = new ArrayBufferSer(headerTypes[i], d);
            data.push(b);
        }

        // create the final buffer
        var all = new ArrayBufferSer(ArrayBufferSer.BUFFER, data);

        callback(null, all.buffer);
    } catch (e) {
        callback(e, null);
    }
};

module.exports = BinaryFormat;
