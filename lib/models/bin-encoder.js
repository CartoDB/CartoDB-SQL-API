'use strict';

function ArrayBufferSer (type, data, options) {
    if (type === undefined) {
        throw new Error('ArrayBufferSer should be created with a type');
    }
    this.options = options || {};
    this._initFunctions();
    this.headerSize = 8;
    this.data = data;
    this.type = type = Math.min(type, ArrayBufferSer.BUFFER);
    var size = this._sizeFor(this.headerSize, data);
    this.buffer = Buffer.alloc(this.headerSize + size);
    this.buffer.writeUInt32BE(type, 0); // this could be one byte but for byte padding is better to be 4 bytes
    this.buffer.writeUInt32BE(size, 4);
    this.offset = this.headerSize;

    var w = this.writeFn[type];

    var i;
    if (!this.options.delta) {
        for (i = 0; i < data.length; ++i) {
            this[w](data[i]);
        }
    } else {
        this[w](data[0]);
        for (i = 1; i < data.length; ++i) {
            this[w](data[i] - data[i - 1]);
        }
    }
}

//
// constants
//
ArrayBufferSer.INT8 = 1;
ArrayBufferSer.UINT8 = 2;
ArrayBufferSer.UINT8_CLAMP = 3;
ArrayBufferSer.INT16 = 4;
ArrayBufferSer.UINT16 = 5;
ArrayBufferSer.INT32 = 6;
ArrayBufferSer.UINT32 = 7;
ArrayBufferSer.FLOAT32 = 8;
// ArrayBufferSer.FLOAT64 = 9; not supported
ArrayBufferSer.STRING = 10;
ArrayBufferSer.BUFFER = 11;

ArrayBufferSer.MAX_PADDING = ArrayBufferSer.INT32;

ArrayBufferSer.typeNames = {
    int8: ArrayBufferSer.INT8,
    uint8: ArrayBufferSer.UINT8,
    uintclamp: ArrayBufferSer.UINT8_CLAMP,
    int16: ArrayBufferSer.INT16,
    uint16: ArrayBufferSer.UINT16,
    int32: ArrayBufferSer.INT32,
    uint32: ArrayBufferSer.UINT32,
    float32: ArrayBufferSer.FLOAT32,
    string: ArrayBufferSer.STRING,
    buffer: ArrayBufferSer.BUFFER
};

ArrayBufferSer.prototype = {

    // 0 not used
    sizes: [NaN, 1, 1, 1, 2, 2, 4, 4, 4, 8],

    _paddingFor: function (off, type) {
        var s = this.sizes[type];
        if (s) {
            var r = off % s;
            return r === 0 ? 0 : s - r;
        }
        return 0;
    },

    _sizeFor: function (offset, t) {
        var self = this;
        var s = this.sizes[this.type];
        if (s) {
            return s * t.length;
        }
        s = 0;
        if (this.type === ArrayBufferSer.STRING) {
            // calculate size with padding
            t.forEach(function (arr) {
                var pad = self._paddingFor(offset, ArrayBufferSer.MAX_PADDING);
                s += pad;
                offset += pad;
                var len = (self.headerSize + arr.length * 2);
                s += len;
                offset += len;
            });
        } else {
            t.forEach(function (arr) {
                var pad = self._paddingFor(offset, ArrayBufferSer.MAX_PADDING);
                s += pad;
                offset += pad;
                s += arr.getSize();
                offset += arr.getSize();
            });
        }
        return s;
    },

    getDataSize: function () {
        return this._sizeFor(0, this.data);
    },

    getSize: function () {
        return this.headerSize + this._sizeFor(this.headerSize, this.data);
    },

    writeFn: [
        '',
        'writeInt8',
        'writeUInt8',
        'writeUInt8Clamp',
        'writeInt16LE',
        'writeUInt16LE',
        'writeUInt32LE',
        'writeUInt32LE',
        'writeFloatLE',
        'writeDoubleLE',
        'writeString',
        'writteBuffer'
    ],

    _initFunctions: function () {
        var self = this;
        this.writeFn.forEach(function (fn) {
            if (self[fn] === undefined) {
                self[fn] = function (d) {
                    self.buffer[fn](d, self.offset);
                    self.offset += self.sizes[self.type];
                };
            }
        });
    },

    writeUInt8Clamp: function (c) {
        this.buffer.writeUInt8(Math.min(255, c), this.offset);
        this.offset += 1;
    },

    writeString: function (s) {
        var arr = [];
        for (var i = 0, len = s.length; i < len; ++i) {
            arr.push(s.charCodeAt(i));
        }
        var str = new ArrayBufferSer(ArrayBufferSer.UINT16, arr);
        this.writteBuffer(str);
    },

    writteBuffer: function (b) {
        this.offset += this._paddingFor(this.offset, ArrayBufferSer.MAX_PADDING);
        // copy header
        b.buffer.copy(this.buffer, this.offset);
        this.offset += b.buffer.length;
    }

};

module.exports = ArrayBufferSer;
