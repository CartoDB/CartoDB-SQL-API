'use strict';

require('../../helper');
var assert = require('assert');

var ArrayBufferSer = require('../../../lib/models/bin-encoder');

describe('ArrayBufferSer', function () {
    it('calculate size for basic types', function () {
        var b = new ArrayBufferSer(ArrayBufferSer.INT16, [1, 2, 3, 4]);
        assert.strictEqual(4 * 2, b.getDataSize());

        b = new ArrayBufferSer(ArrayBufferSer.INT8, [1, 2, 3, 4]);
        assert.strictEqual(4, b.getDataSize());

        b = new ArrayBufferSer(ArrayBufferSer.INT32, [1, 2, 3, 4]);
        assert.strictEqual(4 * 4, b.getDataSize());
    });

    it('calculate size for arrays', function () {
        var b = new ArrayBufferSer(ArrayBufferSer.STRING, ['test', 'kease']);
        assert.strictEqual((b.headerSize + 4 + 5) * 2, b.getDataSize());

        var ba = new ArrayBufferSer(ArrayBufferSer.INT16, [1, 2, 3, 4]);
        var bc = new ArrayBufferSer(ArrayBufferSer.INT16, [1, 4]);

        b = new ArrayBufferSer(ArrayBufferSer.BUFFER, [ba, bc]);
        assert.strictEqual((b.headerSize + 4 + 2) * 2, b.getDataSize());
        assert.strictEqual(b.type, ArrayBufferSer.BUFFER);
    });

    function assertBufferEquals (a, b) {
        assert.strictEqual(a.length, b.length);
        for (var i = 0; i < a.length; ++i) {
            assert.strictEqual(a[i], b[i], 'byte i ' + i + ' is different: ' + a[i] + ' != ' + b[i]);
        }
    }

    it('binary data is ok', function () {
        var b = new ArrayBufferSer(ArrayBufferSer.INT16, [1, 2, 3, 4]);
        var bf = Buffer.from([0, 0, 0, ArrayBufferSer.INT16, 0, 0, 0, 8, 1, 0, 2, 0, 3, 0, 4, 0]);
        assertBufferEquals(bf, b.buffer);
    });

    it('binary data is ok with arrays', function () {
        var ba = new ArrayBufferSer(ArrayBufferSer.INT16, [1, 2, 3, 4]);
        var bc = new ArrayBufferSer(ArrayBufferSer.INT16, [1, 4]);

        var b = new ArrayBufferSer(ArrayBufferSer.BUFFER, [ba, bc]);
        var bf = Buffer.from([
            0, 0, 0, ArrayBufferSer.BUFFER, // type
            0, 0, 0, 28,
            0, 0, 0, ArrayBufferSer.INT16, 0, 0, 0, 8, 1, 0, 2, 0, 3, 0, 4, 0,
            0, 0, 0, ArrayBufferSer.INT16, 0, 0, 0, 4, 1, 0, 4, 0]);
        assertBufferEquals(bf, b.buffer);
    });

    it('binary data is ok with strings', function () {
        var s = 'test';
        var b = new ArrayBufferSer(ArrayBufferSer.STRING, [s]);
        var bf = Buffer.from([
            0, 0, 0, ArrayBufferSer.STRING, // type
            0, 0, 0, 16,
            0, 0, 0, ArrayBufferSer.UINT16,
            0, 0, 0, 8,
            s.charCodeAt(0), 0,
            s.charCodeAt(1), 0,
            s.charCodeAt(2), 0,
            s.charCodeAt(3), 0
        ]);
        assertBufferEquals(bf, b.buffer);
    });
});
