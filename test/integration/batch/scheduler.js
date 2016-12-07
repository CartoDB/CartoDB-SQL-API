'use strict';

require('../../helper');
var debug = require('../../../batch/util/debug')('scheduler-test');
var assert = require('../../support/assert');
var Scheduler = require('../../../batch/scheduler/scheduler');
var FixedCapacity = require('../../../batch/scheduler/capacity/fixed');

describe('scheduler', function() {

    var USER_FINISHED = true;

    var USER_A = 'userA';
    var USER_B = 'userB';
    var USER_C = 'userC';

    function TaskRunner(userTasks) {
        this.results = [];
        this.userTasks = userTasks;
    }

    TaskRunner.prototype.run = function(user, callback) {
        this.results.push(user);
        this.userTasks[user]--;
        setTimeout(function() {
            return callback(null, this.userTasks[user] === 0);
        }.bind(this), 50);
    };

    function ManualTaskRunner() {
        this.userTasks = {};
    }

    ManualTaskRunner.prototype.run = function(user, callback) {
        if (!this.userTasks.hasOwnProperty(user)) {
            this.userTasks[user] = [];
        }
        this.userTasks[user].push(callback);
    };

    ManualTaskRunner.prototype.dispatch = function(user, isDone) {
        if (this.userTasks.hasOwnProperty(user)) {
            var cb = this.userTasks[user].shift();
            if (cb) {
                return cb(null, isDone);
            }
        }
    };


    // simulate one by one or infinity capacity
    var capacities = [new FixedCapacity(1), new FixedCapacity(2), new FixedCapacity(Infinity)];

    capacities.forEach(function(capacity) {

        it('regression #1', function (done) {
            var taskRunner = new TaskRunner({
                userA: 2,
                userB: 2
            });
            var scheduler = new Scheduler(capacity, taskRunner);
            scheduler.add(USER_A);
            scheduler.add(USER_B);

            scheduler.on('done', function() {
                var results = taskRunner.results;

                assert.equal(results.length, 4);

                assert.equal(results[0], USER_A);
                assert.equal(results[1], USER_B);
                assert.equal(results[2], USER_A);
                assert.equal(results[3], USER_B);

                return done();
            });

            scheduler.schedule();
        });

        it('regression #2: it should restart task after it was done but got re-scheduled', function (done) {
            var taskRunner = new ManualTaskRunner();
            var scheduler = new Scheduler(capacity, taskRunner);
            debug('Adding users A and B');
            scheduler.add(USER_A);
            scheduler.add(USER_B);

            var acquiredUsers = [];

            scheduler.on('done', function() {
                debug('Users %j', acquiredUsers);
                assert.equal(acquiredUsers[0], USER_A);
                assert.equal(acquiredUsers[1], USER_B);
                assert.equal(acquiredUsers[2], USER_A);
                assert.equal(acquiredUsers[3], USER_B);

                assert.equal(acquiredUsers.length, 4);

                return done();
            });

            scheduler.on('acquired', function(user) {
                debug('Acquired user %s', user);
                acquiredUsers.push(user);
            });

            scheduler.schedule();

            debug('User A will be mark as DONE');
            taskRunner.dispatch(USER_A, USER_FINISHED);

            debug('User B should be running');
            debug('User A submit a new task');
            scheduler.add(USER_A);

            debug('User B will get another task to run');
            taskRunner.dispatch(USER_B);

            debug('User A should start working on this new task');
            taskRunner.dispatch(USER_A, USER_FINISHED);
            taskRunner.dispatch(USER_B, USER_FINISHED);
        });

        it('should run tasks', function (done) {
            var taskRunner = new TaskRunner({
                userA: 1
            });
            var scheduler = new Scheduler(capacity, taskRunner);
            scheduler.add(USER_A);

            scheduler.on('done', function() {
                var results = taskRunner.results;

                assert.equal(results.length, 1);

                assert.equal(results[0], USER_A);

                return done();
            });

            scheduler.schedule();
        });


        it('should run tasks for different users', function (done) {
            var taskRunner = new TaskRunner({
                userA: 1,
                userB: 1,
                userC: 1
            });
            var scheduler = new Scheduler(capacity, taskRunner);
            scheduler.add(USER_A);
            scheduler.add(USER_B);
            scheduler.add(USER_C);

            scheduler.on('done', function() {
                var results = taskRunner.results;

                assert.equal(results.length, 3);

                assert.equal(results[0], USER_A);
                assert.equal(results[1], USER_B);
                assert.equal(results[2], USER_C);

                return done();
            });

            scheduler.schedule();
        });

        it('should be fair when scheduling tasks', function (done) {
            var taskRunner = new TaskRunner({
                userA: 3,
                userB: 2,
                userC: 1
            });

            var scheduler = new Scheduler(capacity, taskRunner);
            scheduler.add(USER_A);
            scheduler.add(USER_A);
            scheduler.add(USER_A);
            scheduler.add(USER_B);
            scheduler.add(USER_B);
            scheduler.add(USER_C);

            scheduler.on('done', function() {
                var results = taskRunner.results;

                assert.equal(results.length, 6);

                assert.equal(results[0], USER_A);
                assert.equal(results[1], USER_B);
                assert.equal(results[2], USER_C);
                assert.equal(results[3], USER_A);
                assert.equal(results[4], USER_B);
                assert.equal(results[5], USER_A);

                return done();
            });

            scheduler.schedule();
        });
    });
});
