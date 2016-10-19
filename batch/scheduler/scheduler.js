'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var debug = require('../util/debug')('scheduler');

var forever = require('../util/forever');

var STATUS = {
    PENDING: 'pending',
    WAITING: 'waiting',
    RUNNING: 'running',
    DONE: 'done'
};

function Scheduler(capacity, taskRunner) {
    EventEmitter.call(this);
    this.taskRunner = taskRunner;
    this.capacity = capacity;
    this.users = {};
}
util.inherits(Scheduler, EventEmitter);

module.exports = Scheduler;

Scheduler.prototype.add = function(user) {
    debug('add(%s)', user);
    if (!this.users.hasOwnProperty(user) || this.users[user].status === STATUS.DONE) {
        this.users[user] = {
            name: user,
            status: STATUS.PENDING
        };
    }
    return this.run();
};

Scheduler.prototype.run = function() {
    if (this.running) {
        return true;
    }
    this.running = true;

    var self = this;
    forever(
        function (next) {
            debug('Trying to acquire user');
            self.acquire(function(err, user) {
                debug('Acquired user=%s', user);

                if (!user) {
                    return next(new Error('all users finished'));
                }

                // try to acquire next user
                // will block until capacity slow is available
                next();

                debug('Running task for user=%s', user);
                self.taskRunner.run(user, function(err, userQueueIsEmpty, done) {
                    self.release(user, userQueueIsEmpty, done);
                });
            });
        },
        function (err) {
            debug('done: %s', err.message);
            self.running = false;
            self.emit('done');
        }
    );
};

function nextCandidate(users) {
    var sortedCandidates = Object.keys(users)
        .filter(function(user) {
            return isCandidate(users[user]);
        });
//        .sort(function(candidateNameA, candidateNameB) {
//            return users[candidateNameA].status - users[candidateNameB].status;
//        });
    return sortedCandidates[0];
}

function allRunning(users) {
    return all(users, STATUS.RUNNING);
}

function allDone(users) {
    return all(users, STATUS.DONE);
}

function all(users, status) {
    return Object.keys(users).every(function(user) {
        return users[user].status === status;
    });
}

function isCandidate(candidate) {
    return candidate.status === STATUS.PENDING || candidate.status === STATUS.WAITING;
}

function isRunning(candidate) {
    return candidate.status === STATUS.RUNNING;
}

Scheduler.prototype.acquire = function(callback) {
    if (allDone(this.users)) {
        return callback(null, null);
    }
    var self = this;
    this.capacity.getCapacity(function(err, capacity) {
        if (err) {
            return callback(err);
        }

        var running = Object.keys(self.users).filter(function(user) {
            return isRunning(self.users[user]);
        });

        debug('Trying to acquire users=%j, running=%d, capacity=%d', self.users, running.length, capacity);
        var allUsersRunning = allRunning(self.users);
        if (running.length >= capacity || allUsersRunning) {
            debug(
                'Waiting for slot. capacity=%s, running=%s, all_running=%s',
                capacity, running.length, allUsersRunning
            );
            return self.once('release', function() {
                debug('Slot was released');
                self.acquire(callback);
            });
        }

        var candidate = nextCandidate(self.users);
        if (candidate) {
            self.users[candidate].status = STATUS.RUNNING;
        }
        return callback(null, candidate);
    });
};

Scheduler.prototype.release = function(user, isDone, done) {
    debug('Released user=%s done=%s', user, isDone);
    this.users[user].status = isDone ? STATUS.DONE : STATUS.WAITING;
    this.emit('release');

    return done && done();
};
