'use strict';

const { Transform } = require('stream');

module.exports = class Throttler extends Transform {
    constructor (pgstream, ...args) {
        super(...args);

        this.pgstream = pgstream;

        this.sampleLength = global.settings.copy_from_maximum_slow_input_speed_interval || 15;
        this.minimunBytesPerSecondThershold = global.settings.copy_from_minimum_input_speed || 0;
        this.byteCount = 0;
        this.bytesPerSecondHistory = [];

        this._interval = setInterval(this._updateMetrics.bind(this), 1000);
    }

    _updateMetrics () {
        this.bytesPerSecondHistory.push(this.byteCount);
        this.byteCount = 0;

        if (this.bytesPerSecondHistory.length > this.sampleLength) {
            this.bytesPerSecondHistory.shift();
        }

        let doesNotReachThreshold = 0;

        for (const bytesPerSecond of this.bytesPerSecondHistory) {
            if (bytesPerSecond <= this.minimunBytesPerSecondThershold) {
                doesNotReachThreshold += 1;
            }
        }

        if (doesNotReachThreshold >= this.sampleLength) {
            clearInterval(this._interval);
            this.pgstream.emit('error', new Error('Connection closed by server: input data too slow'));
        }
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
