'use strict';

require('../../helper');
var assert = require('../../support/assert');
var Scheduler = require('../../../batch/scheduler/scheduler');
var FixedCapacity = require('../../../batch/scheduler/capacity/fixed');

describe('scheduler', function() {

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

        it('regression #2', function (done) {
            var taskRunner = new TaskRunner({
                userA: 2,
                userB: 2,
                userC: 2,
                userD: 1
            });
            var scheduler = new Scheduler(capacity, taskRunner);
            scheduler.add(USER_A);
            scheduler.add(USER_B);

            scheduler.on('done', function() {
                var results = taskRunner.results;

                assert.equal(results.length, 7);

                assert.equal(results[0], USER_A);
                assert.equal(results[1], USER_B);
                assert.equal(results[2], USER_C);
                assert.equal(results[3], 'userD');
                assert.equal(results[4], USER_A);
                assert.equal(results[5], USER_B);
                assert.equal(results[6], USER_C);

                return done();
            });

            setTimeout(function() {
                scheduler.add(USER_C);
            }, 10);

            setTimeout(function() {
                scheduler.add('userD');
            }, 20);

            scheduler.schedule();
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
