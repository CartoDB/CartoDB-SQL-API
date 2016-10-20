'use strict';

require('../../helper');
var assert = require('../../support/assert');
var Scheduler = require('../../../batch/scheduler/scheduler');
var FixedCapacity = require('../../../batch/scheduler/capacity/fixed');

describe('scheduler', function() {

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
    var capacities = [new FixedCapacity(1), new FixedCapacity(Infinity)];

    capacities.forEach(function(capacity) {

        it('regression', function (done) {
            var taskRunner = new TaskRunner({
                userA: 2,
                userB: 2
            });
            var scheduler = new Scheduler(capacity, taskRunner);
            scheduler.add('userA');
            scheduler.add('userB');

            scheduler.on('done', function() {
                var results = taskRunner.results;

                assert.equal(results.length, 4);

                assert.equal(results[0], 'userA');
                assert.equal(results[1], 'userB');
                assert.equal(results[2], 'userA');
                assert.equal(results[3], 'userB');

                return done();
            });

            scheduler.schedule();
        });

        it('should run tasks', function (done) {
            var taskRunner = new TaskRunner({
                userA: 1
            });
            var scheduler = new Scheduler(capacity, taskRunner);
            scheduler.add('userA');

            scheduler.on('done', function() {
                var results = taskRunner.results;

                assert.equal(results.length, 1);

                assert.equal(results[0], 'userA');

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
            scheduler.add('userA');
            scheduler.add('userB');
            scheduler.add('userC');

            scheduler.on('done', function() {
                var results = taskRunner.results;

                assert.equal(results.length, 3);

                assert.equal(results[0], 'userA');
                assert.equal(results[1], 'userB');
                assert.equal(results[2], 'userC');

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
            scheduler.add('userA');
            scheduler.add('userA');
            scheduler.add('userA');
            scheduler.add('userB');
            scheduler.add('userB');
            scheduler.add('userC');

            scheduler.on('done', function() {
                var results = taskRunner.results;

                assert.equal(results.length, 6);

                assert.equal(results[0], 'userA');
                assert.equal(results[1], 'userB');
                assert.equal(results[2], 'userC');
                assert.equal(results[3], 'userA');
                assert.equal(results[4], 'userB');
                assert.equal(results[5], 'userA');

                return done();
            });

            scheduler.schedule();
        });
    });
});
