'use strict';

const { Transform } = require('stream');

module.exports = class Throttler extends Transform {
    constructor (pgstream, ...args) {
        super(...args);

        this.pgstream = pgstream;

        this.sampleSeconds = global.settings.copy_from_maximum_slow_input_speed_interval || 15;
        this.minimunBytesPerSampleThreshold = global.settings.copy_from_minimum_input_speed || 0;
        this.byteCount = 0;

        this._interval = setInterval(this._updateMetrics.bind(this), this.sampleSeconds * 1000);
    }

    _updateMetrics () {
        if (this.byteCount < this.minimunBytesPerSampleThreshold) {
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
