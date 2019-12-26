'use strict';

var Pg = require('./../pg');

var svgWidth = 1024.0;
var svgHeight = 768.0;
var svgRatio = svgWidth / svgHeight;

var radius = 5; // in pixels (based on svgWidth and svgHeight)

var strokeWidth = 1; // in pixels (based on svgWidth and svgHeight)
var strokeColor = 'black';
// fill settings affect polygons and points (circles)
var fillOpacity = 0.5; // 0.0 is fully transparent, 1.0 is fully opaque
// unused if fillColor='none'
var fillColor = 'none'; // affects polygons and circles

function SvgFormat () {
    this.totalRows = 0;

    this.bbox = null; // will be computed during the results scan
    this.buffer = '';

    this._streamingStarted = false;
}

SvgFormat.prototype = new Pg('svg');
SvgFormat.prototype._contentType = 'image/svg+xml; charset=utf-8';

SvgFormat.prototype.getQuery = function (sql, options) {
    var gn = options.gn;
    var dp = options.dp;
    return 'WITH source AS ( ' + sql + '), extent AS ( ' +
        ' SELECT ST_Extent(' + gn + ') AS e FROM source ' +
        '), extent_info AS ( SELECT e, ' +
        'st_xmin(e) as ex0, st_ymax(e) as ey0, ' +
        'st_xmax(e)-st_xmin(e) as ew, ' +
        'st_ymax(e)-st_ymin(e) as eh FROM extent )' +
        ', trans AS ( SELECT CASE WHEN ' +
        'eh = 0 THEN ' + svgWidth +
        '/ COALESCE(NULLIF(ew,0),' + svgWidth + ') WHEN ' +
        svgRatio + ' <= (ew / eh) THEN (' +
        svgWidth + '/ew ) ELSE (' +
        svgHeight + '/eh ) END as s ' +
        ', ex0 as x0, ey0 as y0 FROM extent_info ) ' +
        'SELECT st_TransScale(e, -x0, -y0, s, s)::box2d as ' +
        gn + '_box, ST_Dimension(' + gn + ') as ' + gn +
        '_dimension, ST_AsSVG(ST_TransScale(' + gn + ', ' +
        '-x0, -y0, s, s), 0, ' + dp + ') as ' + gn +
        // + ', ex0, ey0, ew, eh, s ' // DEBUG ONLY +
        ' FROM trans, extent_info, source' +
        ' ORDER BY the_geom_dimension ASC';
};

SvgFormat.prototype.startStreaming = function () {
    if (this.opts.beforeSink) {
        this.opts.beforeSink();
    }

    var header = [
        '<?xml version="1.0" standalone="no"?>',
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'
    ];

    var rootTag = '<svg ';
    if (this.bbox) {
        // expand box by "radius" + "stroke-width"
        // TODO: use a Box2d class for these ops
        var growby = radius + strokeWidth;
        this.bbox.xmin -= growby;
        this.bbox.ymin -= growby;
        this.bbox.xmax += growby;
        this.bbox.ymax += growby;
        this.bbox.width = this.bbox.xmax - this.bbox.xmin;
        this.bbox.height = this.bbox.ymax - this.bbox.ymin;
        rootTag += 'viewBox="' + this.bbox.xmin + ' ' + (-this.bbox.ymax) + ' ' +
            this.bbox.width + ' ' + this.bbox.height + '" ';
    }
    rootTag += 'style="fill-opacity:' + fillOpacity + '; stroke:' + strokeColor + '; ' +
        'stroke-width:' + strokeWidth + '; fill:' + fillColor + '" ';
    rootTag += 'xmlns="http://www.w3.org/2000/svg" version="1.1">\n';

    header.push(rootTag);

    this.opts.sink.write(header.join('\n'));

    this._streamingStarted = true;
};

SvgFormat.prototype.handleQueryRow = function (row) {
    this.totalRows++;

    if (!Object.prototype.hasOwnProperty.call(row, this.opts.gn)) {
        this.error = new Error('column "' + this.opts.gn + '" does not exist');
    }

    var g = row[this.opts.gn];
    if (!g) {
        return;
    } // null or empty

    var gdims = row[this.opts.gn + '_dimension'];
    // TODO: add an identifier, if any of "cartodb_id", "oid", "id", "gid" are found
    // TODO: add "class" attribute to help with styling ?
    if (gdims === 0) {
        this.buffer += '<circle r="' + radius + '" ' + g + ' />\n';
    } else if (gdims === 1) {
        // Avoid filling closed linestrings
        this.buffer += '<path ' + (fillColor !== 'none' ? 'fill="none" ' : '') + 'd="' + g + '" />\n';
    } else if (gdims === 2) {
        this.buffer += '<path d="' + g + '" />\n';
    }

    if (!this.bbox) {
        // Parse layer extent: "BOX(x y, X Y)"
        // NOTE: the name of the extent field is
        //       determined by the same code adding the
        //       ST_AsSVG call (in queryResult)
        //
        var bbox = row[this.opts.gn + '_box'];
        bbox = bbox.match(/BOX\(([^ ]*) ([^ ,]*),([^ ]*) ([^)]*)\)/);
        this.bbox = {
            xmin: parseFloat(bbox[1]),
            ymin: parseFloat(bbox[2]),
            xmax: parseFloat(bbox[3]),
            ymax: parseFloat(bbox[4])
        };
    }

    if (!this._streamingStarted && this.bbox) {
        this.startStreaming();
    }

    if (this._streamingStarted && (this.totalRows % (this.opts.bufferedRows || 1000))) {
        this.opts.sink.write(this.buffer);
        this.buffer = '';
    }
};

SvgFormat.prototype.handleQueryEnd = function () {
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

    // rootTag close
    this.buffer += '</svg>\n';

    this.opts.sink.write(this.buffer);
    this.opts.sink.end();

    this.callback();
};

module.exports = SvgFormat;
