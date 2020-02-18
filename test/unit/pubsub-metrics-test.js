'use strict';

require('../helper');

const sinon = require('sinon');

const MetadataDB = require('cartodb-redis');
const assert = require('../support/assert');
const PubSubMetricsService = require('../../lib/services/pubsub-metrics');

const metadataBackend = new MetadataDB({
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
});

describe.only('pubsub metrics service', function () {
    let isDisabledStub;
    let publishStub;

    before(function () {
        global.settings.pubSubMetrics.topic = 'test-topic';

        sinon.stub(PubSubMetricsService.prototype, 'initPubSub');
        sinon.stub(PubSubMetricsService.prototype, 'getTopic');
        publishStub = sinon.stub(PubSubMetricsService.prototype, 'publish');
        isDisabledStub = sinon.stub(PubSubMetricsService.prototype, 'isDisabled');
    });

    after(function () {
        global.settings.pubSubMetrics.topic = '';
        PubSubMetricsService.prototype.initPubSub.restore();
        PubSubMetricsService.prototype.getTopic.restore();
        PubSubMetricsService.prototype.isDisabled.restore();
        PubSubMetricsService.prototype.publish.restore();
    });

    it('should not send event if not enabled', function (done) {
        isDisabledStub.returns(true);
        const pubSubMetricsService = new PubSubMetricsService(metadataBackend);
        const username = 'vizzuality';
        const event = 'test-event';
        const attributes = {
            event_source: 'test',
            event_group_id: '1',
            response_code: '200',
            source_domain: 'vizzuality.cartodb.com',
            event_version: '1'
        };

        pubSubMetricsService.sendEvent(username, event, attributes, function (err, res) {
            if (err) {
                return done(err);
            }

            assert(publishStub.notCalled);
            done();
        });
    });

    it('should send event with user_id if enabled', function (done) {
        isDisabledStub.returns(false);
        const pubSubMetricsService = new PubSubMetricsService(metadataBackend);
        const username = 'vizzuality';
        const event = 'test-event';
        const attributes = {
            event_source: 'test',
            event_group_id: '1',
            response_code: '200',
            source_domain: 'vizzuality.cartodb.com',
            event_version: '1'
        };

        const expectedAttributes = Object.assign({ user_id: '1' }, attributes);
        pubSubMetricsService.sendEvent(username, event, attributes, function (err, res) {
            if (err) {
                return done(err);
            }

            assert(publishStub.calledOnceWith(event, expectedAttributes));
            done();
        });
    });
});
