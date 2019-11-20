'use strict';

const { Transform } = require('stream');

module.exports = class Throttler extends Transform {
    constructor (pgstream, ...args) {
        super(...args);

        this.pgstream = pgstream;

        this.sampleLength = global.settings.copy_from_maximum_slow_input_speed_interval || 15;
        this.minimunBytesPerSecondThreshold = global.settings.copy_from_minimum_input_speed || 0;
        this.byteCount = 0;

        this._interval = setInterval(this._updateMetrics.bind(this), this.sampleLength*1000);
    }

    _updateMetrics () {
        if (this.byteCount < this.minimunBytesPerSecondThreshold) {
            clearInterval(this._interval);
            this.pgstream.emit('error', new Error('Connection closed by server: input data too slow'));
        }
        this.byteCount = 0;
    }

    _transform (chunk, encoding, callback) {
        this.byteCount += chunk.length;
        callback(null, chunk);
    }

    _flush (callback) {
        clearInterval(this._interval);
        callback();
    }
};
