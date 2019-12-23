'use strict';

describe('Event', function () {
    before_each(function () {
        this.evt = new Event();
    });

    it('call event binded', function () {
        var c = 0;
        function callback () {
            c++;
        }
        this.evt.on('test', callback);
        this.evt.emit('test');
        assert(c == 1);
    });

    it('should works when call non existing event', function () {
        this.evt.emit('test_no_exists');
    });
});

describe('MapModel', function () {
    before_each(function () {
        this.map_model = new MapModel(new LatLng(0, 0));
    });

    it('center_changed should be called', function () {
        var c = 0;
        this.map_model.on('center_changed', function () {
            ++c;
        });
        this.map_model.setCenter(new LatLng(0, 0));
        assert(c == 1);
    });

    it('zoom_changed should be called', function () {
        var c = 0;
        this.map_model.on('zoom_changed', function () {
            ++c;
        });
        this.map_model.setZoom(2);
        assert(c == 1);
    });

    it('visibleTiles', function () {
        var ts = this.map_model.projection.TILE_SIZE;
        this.map_model.setZoom(10);
        var tiles = this.map_model.visibleTiles(ts, ts);
        assert(tiles.length == 4);
        this.map_model.setCenter(new LatLng(0.3, 1.2));
        tiles = this.map_model.visibleTiles(ts, ts);
        assert(tiles.length == 4);
    });
});
