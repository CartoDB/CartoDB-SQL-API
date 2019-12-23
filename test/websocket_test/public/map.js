'use strict';

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
              window.webkitRequestAnimationFrame ||
              window.mozRequestAnimationFrame ||
              window.oRequestAnimationFrame ||
              window.msRequestAnimationFrame ||
              function (callback) {
                  window.setTimeout(callback, 1000 / 60);
              };
})();

function Event () {}
Event.prototype.on = function (evt, callback) {
    var cb = this.callbacks = this.callbacks || {};
    var l = cb[evt] || (cb[evt] = []);
    l.push(callback);
};

Event.prototype.emit = function (evt) {
    var c = this.callbacks && this.callbacks[evt];
    for (var i = 0; c && i < c.length; ++i) {
        c[i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
};

function MapModel (opts) {
    opts = opts || {};
    this.projection = new MercatorProjection();
    this.setCenter(opts.center || new LatLng(0, 0));
    this.setZoom(opts.zoom || 1);
}

MapModel.prototype = new Event();

MapModel.prototype.setCenter = function (center) {
    this.center = new LatLng(center.lat, center.lng);
    this.center_pixel = this.projection.fromLatLngToPixel(this.center, this.zoom).floor();
    this.emit('center_changed', this.center);
};

MapModel.prototype.setZoom = function (zoom) {
    this.zoom = zoom;
    this.center_pixel = this.projection.fromLatLngToPixel(this.center, this.zoom).floor();
    this.emit('zoom_changed', this.center);
};

MapModel.prototype.getCenterPixel = function () {
    var center_point = this.projection.fromLatLngToPixel(this.center, this.zoom);
    return center_point;
};

MapModel.prototype.getTopLeft = function (width, height) {
    var center_point = this.projection.fromLatLngToPixel(this.center, this.zoom);
    var widthHalf = width / 2;
    var heightHalf = height / 2;
    center_point.x -= widthHalf;
    center_point.y -= heightHalf;
    return center_point;
};
MapModel.prototype.getBBox = function (width, height) {
    var center_point = this.projection.fromLatLngToPixel(this.center, this.zoom);
    var widthHalf = width / 2;
    var heightHalf = height / 2;
    center_point.x -= widthHalf;
    center_point.y += heightHalf;
    var bottomleft = this.projection.fromPixelToLatLng(center_point, this.zoom);
    center_point.x += width;
    center_point.y -= height;
    var topRight = this.projection.fromPixelToLatLng(center_point, this.zoom);
    return [bottomleft, topRight];
};

/**
 * return a list of tiles inside the spcified zone
 * the center will be placed on the center of that zone
 */
MapModel.prototype.visibleTiles = function (width, height) {
    var self = this;
    var widthHalf = width / 2;
    var heightHalf = height / 2;
    var center_point = self.projection.fromLatLngToPixel(self.center, self.zoom);
    center_point.x -= widthHalf;
    center_point.y -= heightHalf;
    var tile = this.projection.pixelToTile(center_point, self.zoom);
    var offset_x = center_point.x % this.projection.TILE_SIZE;
    var offset_y = center_point.y % this.projection.TILE_SIZE;

    var num_tiles_x = Math.ceil((width + offset_x) / this.projection.TILE_SIZE);
    var num_tiles_y = Math.ceil((height + offset_y) / this.projection.TILE_SIZE);

    var tiles = [];
    for (var i = 0; i < num_tiles_x; ++i) {
        for (var j = 0; j < num_tiles_y; ++j) {
            var tile_x = tile.x + i;
            var tile_y = tile.y + j;
            tiles.push({
                x: tile_x * this.projection.TILE_SIZE,
                y: tile_y * this.projection.TILE_SIZE,
                zoom: self.zoom,
                i: tile_x,
                j: tile_y
            });
        }
    }
    return tiles;
};

function dragger (el) {
    var self = this;
    var dragging = false;
    var x, y;

    el.ontouchstart = el.onmousedown = function (e) {
        dragging = true;
        if (e.touches) {
            var p = e.touches[0];
            x = p.pageX;
            y = p.pageY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        self.emit('startdrag', x, y);
    };

    el.ontouchmove = el.onmousemove = function (e) {
        var xx, yy;
        if (!dragging) return;
        if (e.touches) {
            var p = e.touches[0];
            xx = p.pageX;
            yy = p.pageY;
        } else {
            xx = e.clientX;
            yy = e.clientY;
        }
        self.emit('move', xx - x, yy - y);
        return false;
    };

    el.ontouchend = el.onmouseup = function (e) {
        dragging = false;
        self.emit('enddrag', x, y);
    };
}

dragger.prototype = new Event();

function CanvasRenderer (el, map) {
    var self = this;
    this.el = el;
    this.tiles = {};
    this.width = el.offsetWidth >> 0;
    this.height = el.offsetHeight >> 0;
    var widthHalf = (this.width / 2) >> 0;
    var heightHalf = (this.height / 2) >> 0;

    var canvas = this.canvas = document.createElement('canvas');
    canvas.style.padding = '0';
    canvas.style.margin = '0';
    canvas.style.position = 'absolute';
    canvas.width = this.width;
    canvas.height = this.height;

    var context = canvas.getContext('2d');
    context.translate(widthHalf, heightHalf);
    this.context = context;

    var div = document.createElement('div');
    div.style.width = this.width + 'px';
    div.style.height = this.height + 'px';
    div.style.position = 'relative';
    div.appendChild(canvas);
    el.appendChild(div);

    this.center_init = null;
    this.target_center = new LatLng();
    this.drag = new dragger(div);
    this.drag.on('startdrag', function () {
        self.center_init = map.center.clone();
    });
    this.drag.on('enddrag', function () {
        map.emit('end_move');
    });

    function go_to_target () {
        var c = map.center;
        var t = self.target_center;
        var dlat = t.lat - c.lat;
        var dlon = t.lng - c.lng;
        t.lat += dlat * 0.0001;
        t.lng += dlon * 0.0001;
        map.setCenter(t);
        if (Math.abs(dlat) + Math.abs(dlon) > 0.001) {
            requestAnimFrame(go_to_target);
        } else {
            // map.emit('end_move');
        }
    }

    this.drag.on('move', function (dx, dy) {
        var t = 1 << map.zoom;
        var s = 1 / t;
        s = s / map.projection.pixelsPerLonDegree_;
        self.target_center.lat = self.center_init.lat + dy * s;
        self.target_center.lng = self.center_init.lng - dx * s;
        requestAnimFrame(go_to_target);
    });
}

CanvasRenderer.prototype.renderTile = function (tile, at) {
    var self = this;
    var key = at.x + '_' + at.y;
    if (a = self.tiles[key]) {
        self.context.drawImage(a, at.x, at.y);
        return;
    }

    // var layer = 'http://a.tile.cloudmade.com/BC9A493B41014CAABB98F0471D759707/997/256/{{z}}/{{x}}/{{y}}.png';
    var layer = 'http://b.tiles.mapbox.com/v3/mapbox.mapbox-light/{{z}}/{{x}}/{{y}}.png64';
    var url = layer.replace('{{z}}', tile.zoom).replace('{{x}}', tile.i).replace('{{y}}', tile.j);
    var img = new Image();
    img.src = url;
    img.onload = function () {
        self.context.drawImage(img, at.x, at.y);
        self.tiles[key] = img;
    };
};

CanvasRenderer.prototype.renderTiles = function (tiles, center) {
    for (var i = 0; i < tiles.length; ++i) {
        var tile = tiles[i];
        var p = new Point(tile.x, tile.y);
        p.x -= center.x;
        p.y -= center.y;
        this.renderTile(tile, p);
    }
};

function Map (el, opts) {
    opts = opts || {};
    var self = this;
    this.model = new MapModel({
        center: opts.center || new LatLng(41.69, -4.83),
        zoom: opts.zoom || 1
    });
    this.view = new CanvasRenderer(el, this.model);
    /* function render() {
        var tiles = self.model.visibleTiles(self.view.width, self.view.height);
        self.view.renderTiles(tiles, this.center_pixel);
    }
    this.model.on('center_changed', render);
    this.model.on('zoom_changed', render);
    this.model.emit('center_changed');
    */
}
