'use strict';

require('../helper');

const sinon = require('sinon');
const assert = require('../support/assert');
const PubSubMetricsService = require('../../lib/services/pubsub-metrics');

const fakeTopic = {
    name: 'test-topic',
    publish: sinon.stub().returns(Promise.resolve())
};

const fakePubSub = {
    topic: () => fakeTopic
};

const eventAttributes = {
    event_source: 'test',
    user_id: '123',
    event_group_id: '1',
    response_code: '200',
    source_domain: 'vizzuality.cartodb.com',
    event_time: new Date().toISOString(),
    event_version: '1'
};

describe('pubsub metrics service', function () {
    it('should not send event if not enabled', function () {
        const pubSubMetricsService = new PubSubMetricsService(fakePubSub, false);

        pubSubMetricsService.sendEvent('test-event', eventAttributes);
        assert(fakeTopic.publish.notCalled);
    });

    it('should send event if enabled', function () {
        const pubSubMetricsService = new PubSubMetricsService(fakePubSub, true);

        pubSubMetricsService.sendEvent('test-event', eventAttributes);
        assert(fakeTopic.publish.calledOnceWith(Buffer.from('test-event'), eventAttributes));
    });
});
