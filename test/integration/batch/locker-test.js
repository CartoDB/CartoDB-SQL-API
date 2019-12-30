'use strict';

require('../../helper');

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis-utils');
var Locker = require('../../../lib/batch/leader/locker');

describe('locker', function () {
    var host = 'localhost';

    var TTL = 500;

    var config = { ttl: TTL, pool: redisUtils.getPool() };

    it('should lock and unlock', function (done) {
        var lockerA = Locker.create('redis-distlock', config);
        var lockerB = Locker.create('redis-distlock', config);
        lockerA.lock(host, function (err, lock) {
            if (err) {
                return done(err);
            }
            assert.ok(lock);

            // others can't lock on same host
            lockerB.lock(host, function (err) {
                assert.ok(err);
                assert.strictEqual(err.name, 'LockError');

                lockerA.unlock(host, function (err) {
                    assert.ok(!err);
                    // others can lock after unlock
                    lockerB.lock(host, function (err, lock2) {
                        assert.ok(!err);
                        assert.ok(lock2);
                        lockerB.unlock(host, done);
                    });
                });
            });
        });
    });

    it('should lock and keep locking until unlock', function (done) {
        var lockerA = Locker.create('redis-distlock', config);
        var lockerB = Locker.create('redis-distlock', config);
        lockerA.lock(host, function (err, lock) {
            if (err) {
                return done(err);
            }
            setTimeout(function () {
                lockerB.lock(host, function (err) {
                    assert.ok(err);

                    assert.ok(lock);
                    lockerA.unlock(host, done);
                });
            }, 2 * TTL);
        });
    });
});
