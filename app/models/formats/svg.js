
var _ = require('underscore')

function svg() {
}

var svg_width  = 1024.0;
var svg_height = 768.0;
var svg_ratio = svg_width/svg_height;

svg.prototype = {

  id: "svg",


  getQuery: function(sql, options) {
    var gn = options.gn;
    var dp = options.dp;
    return  'WITH source AS ( ' + sql + '), extent AS ( '
          + ' SELECT ST_Extent(' + gn + ') AS e FROM source '
          + '), extent_info AS ( SELECT e, '
          + 'st_xmin(e) as ex0, st_ymax(e) as ey0, '
          + 'st_xmax(e)-st_xmin(e) as ew, '
          + 'st_ymax(e)-st_ymin(e) as eh FROM extent )'
          + ', trans AS ( SELECT CASE WHEN '
          + 'eh = 0 THEN ' + svg_width
          + '/ COALESCE(NULLIF(ew,0),' + svg_width +') WHEN '
          + svg_ratio + ' <= (ew / eh) THEN ('
          + svg_width  + '/ew ) ELSE ('
          + svg_height + '/eh ) END as s '
          + ', ex0 as x0, ey0 as y0 FROM extent_info ) '
          + 'SELECT st_TransScale(e, -x0, -y0, s, s)::box2d as '
          + gn + '_box, ST_Dimension(' + gn + ') as ' + gn
          + '_dimension, ST_AsSVG(ST_TransScale(' + gn + ', '
          + '-x0, -y0, s, s), 0, ' + dp + ') as ' + gn
          //+ ', ex0, ey0, ew, eh, s ' // DEBUG ONLY
          + ' FROM trans, extent_info, source';
  },

  getContentType: function(){
    return "image/svg+xml; charset=utf-8";
  },

  getFileExtension: function() {
    return this.id;
  },

  transform: function(result, options, callback) {
    toSVG(result.rows, options.gn, callback);
  }

};


function toSVG(rows, gn, callback) {

    var radius = 5; // in pixels (based on svg_width and svg_height)
    var stroke_width = 1; // in pixels (based on svg_width and svg_height)
    var stroke_color = 'black';
    // fill settings affect polygons and points (circles)
    var fill_opacity = 0.5; // 0.0 is fully transparent, 1.0 is fully opaque
                            // unused if fill_color='none'
    var fill_color = 'none'; // affects polygons and circles

    var bbox; // will be computed during the results scan
    var polys = [];
    var lines = [];
    var points = [];
    _.each(rows, function(ele){
        if ( ! ele.hasOwnProperty(gn) ) {
          throw new Error('column "' + gn + '" does not exist');
        }
        var g = ele[gn];
        if ( ! g ) return; // null or empty
        var gdims = ele[gn + '_dimension'];

        // TODO: add an identifier, if any of "cartodb_id", "oid", "id", "gid" are found
        // TODO: add "class" attribute to help with styling ?
        if ( gdims == '0' ) {
          points.push('<circle r="[RADIUS]" ' + g + ' />');
        } else if ( gdims == '1' ) {
          // Avoid filling closed linestrings
          var linetag = '<path ';
          if ( fill_color != 'none' ) linetag += 'fill="none" '
          linetag += 'd="' + g + '" />';
          lines.push(linetag);
        } else if ( gdims == '2' ) {
          polys.push('<path d="' + g + '" />');
        }

        if ( ! bbox ) {
          // Parse layer extent: "BOX(x y, X Y)"
          // NOTE: the name of the extent field is
          //       determined by the same code adding the
          //       ST_AsSVG call (in queryResult)
          //
          bbox = ele[gn + '_box'];
          bbox = bbox.match(/BOX\(([^ ]*) ([^ ,]*),([^ ]*) ([^)]*)\)/);
          bbox = {
            xmin: parseFloat(bbox[1]),
            ymin: parseFloat(bbox[2]),
            xmax: parseFloat(bbox[3]),
            ymax: parseFloat(bbox[4])
           };
        }
    });

    // Set point radius
    for (var i=0; i<points.length; ++i) {
      points[i] = points[i].replace('[RADIUS]', radius);
    }

    var header_tags = [
        '<?xml version="1.0" standalone="no"?>',
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
    ];

    var root_tag = '<svg ';
    if ( bbox ) {
      // expand box by "radius" + "stroke-width"
      // TODO: use a Box2d class for these ops
      var growby = radius+stroke_width;
      bbox.xmin -= growby;
      bbox.ymin -= growby;
      bbox.xmax += growby;
      bbox.ymax += growby;
      bbox.width = bbox.xmax - bbox.xmin;
      bbox.height = bbox.ymax - bbox.ymin;
      root_tag += 'viewBox="' + bbox.xmin + ' ' + (-bbox.ymax) + ' '
               + bbox.width + ' ' + bbox.height + '" ';
    }
    root_tag += 'style="fill-opacity:' + fill_opacity
              + '; stroke:' + stroke_color
              + '; stroke-width:' + stroke_width
              + '; fill:' + fill_color
              + '" ';
    root_tag += 'xmlns="http://www.w3.org/2000/svg" version="1.1">';

    header_tags.push(root_tag);

    // Render points on top of lines and lines on top of polys
    var out = header_tags.concat(polys, lines, points);

    out.push('</svg>');

    // return payload
    callback(null, out.join("\n"));
}

module.exports = new svg();
