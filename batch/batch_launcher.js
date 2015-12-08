'use strict';

function BatchLauncher(batchManager) {
    this.batchManager = batchManager;
    this.batchInterval = global.settings.batch_interval;
}

BatchLauncher.prototype.start = function (interval) {
    var self = this;
    interval = this.batchInterval || interval || 5000;

    this.intervalCallback = setInterval(function () {
        self.batchManager.run();
    }, interval);
};

BatchLauncher.prototype.stop = function () {
    clearInterval(this.intervalCallback);
};

module.exports = BatchLauncher;
