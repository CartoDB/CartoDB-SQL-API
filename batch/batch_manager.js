'use strict';

function BatchManager(jobDequeuer, queryRunner, jobCounter) {
    this.jobDequeuer = jobDequeuer;
    this.queryRunner = queryRunner;
    this.jobCounter = jobCounter;
}

BatchManager.prototype.run = function () {
    var self = this;

    this.jobDequeuer.dequeue(function (err, pg, job, host) {
        if (err) {
            return console.error(err);
        }

        if (!pg || !job || !host) {
            return console.info('No job launched');
        }

        self.queryRunner.run(pg, job, host, function (err) {
            if (err) {
                return console.error(err);
            }

            if (!this.jobCounter.decrement(host)) {
                return console.warn('Job counter for instance %s is out of range', host);
            }

            console.info('Job %s done successfully', job.job_id);
        });
    });
};

module.exports = BatchManager;
