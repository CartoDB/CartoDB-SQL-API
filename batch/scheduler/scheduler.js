'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var debug = require('../util/debug')('scheduler');

var forever = require('../util/forever');

function Scheduler(capacity, taskRunner) {
    EventEmitter.call(this);
    this.taskRunner = taskRunner;
    this.capacity = capacity;
    this.tasks = [];
    this.users = {};
}
util.inherits(Scheduler, EventEmitter);

module.exports = Scheduler;

Scheduler.prototype.add = function(user) {
    debug('add(%s)', user);
    var task = this.users[user];
    if (task) {
        if (task.status === STATUS.DONE) {
            task.status = STATUS.PENDING;
        }

        return true;
    } else {
        task = new TaskEntity(user);
        this.tasks.push(task);
        this.users[user] = task;

        return false;
    }
};

Scheduler.prototype.schedule = function() {
    if (this.running) {
        return true;
    }
    this.running = true;

    var self = this;
    forever(
        function (next) {
            debug('Trying to acquire user');
            self.acquire(function(err, taskEntity) {
                debug('Acquired user=%s', taskEntity);

                if (!taskEntity) {
                    return next(new Error('all users finished'));
                }

                taskEntity.status = STATUS.RUNNING;
                // try to acquire next user
                // will block until capacity slow is available
                next();

                debug('Running task for user=%s', taskEntity.user);
                self.taskRunner.run(taskEntity.user, function(err, userQueueIsEmpty) {
                    taskEntity.status = userQueueIsEmpty ? STATUS.DONE : STATUS.PENDING;

                    self.release(err, taskEntity);
                });
            });
        },
        function (err) {
            debug('done: %s', err.message);
            self.running = false;
            self.emit('done');
        }
    );

    return false;
};

Scheduler.prototype.acquire = function(callback) {
    if (this.tasks.every(is(STATUS.DONE))) {
        return callback(null, null);
    }
    var self = this;
    this.capacity.getCapacity(function(err, capacity) {
        if (err) {
            return callback(err);
        }

        var running = self.tasks.filter(is(STATUS.RUNNING));

        debug('Trying to acquire users=%j, running=%d, capacity=%d', self.tasks, running.length, capacity);
        var allUsersRunning = self.tasks.every(is(STATUS.RUNNING));
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

        var candidate = self.tasks.filter(is(STATUS.PENDING))[0];

        return callback(null, candidate);
    });
};

Scheduler.prototype.release = function(err, taskEntity) {
    debug('Released %j', taskEntity);
    // decide what to do based on status/jobs
    this.emit('release');
};


/* Task entities */

var STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    DONE: 'done'
};

function TaskEntity(user) {
    this.user = user;
    this.status = STATUS.PENDING;
    this.jobs = 0;
}

TaskEntity.prototype.is = function(status) {
    return this.status === status;
};

function is(status) {
    return function(taskEntity) {
        return taskEntity.is(status);
    };
}
