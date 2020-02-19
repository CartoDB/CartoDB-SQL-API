'use strict';

require('../helper');

const sinon = require('sinon');

const qs = require('querystring');
const assert = require('../support/assert');
const app = require('../../lib/server');
const PubSubMetricsService = require('../../lib/services/pubsub-metrics');

var request = {
    url: '/api/v1/sql?' + qs.stringify({
        q: 'SELECT * FROM untitle_table_4'
    }),
    headers: {
        host: 'vizzuality.cartodb.com'
    },
    method: 'GET'
};

const fakeTopic = {
    name: 'test-topic',
    publish: sinon.stub().returns(Promise.resolve())
};

const fakePubSub = {
    topic: () => fakeTopic
};

describe('pubsub metrics middleware', function () {
    let server;
    let clock;

    before(function () {
        clock = sinon.useFakeTimers();
        sinon.stub(PubSubMetricsService, 'createPubSub').returns(fakePubSub);
    });

    after(function () {
        clock.restore();
        PubSubMetricsService.createPubSub.restore();
        global.settings.pubSubMetrics.enabled = false;
    });

    it('should not send event if disabled', function (done) {
        global.settings.pubSubMetrics.enabled = false;
        server = app();

        assert.response(server, request, { status: 200 }, function (err, res) {
            if (err) {
                return done(err);
            }

            assert(fakeTopic.publish.notCalled);
            return done();
        });
    });

    it('should not send event if headers not present', function (done) {
        global.settings.pubSubMetrics.enabled = true;
        server = app();

        assert.response(server, request, { status: 200 }, function (err, res) {
            if (err) {
                return done(err);
            }

            assert(fakeTopic.publish.notCalled);
            return done();
        });
    });

    it('should send event if headers present', function (done) {
        global.settings.pubSubMetrics.enabled = true;
        server = app();
        request.headers['Carto-Event'] = 'test-event';
        request.headers['Carto-Event-Source'] = 'test';
        request.headers['Carto-Event-Group-Id'] = '1';

        const eventAttributes = {
            event_source: 'test',
            user_id: '1',
            event_group_id: '1',
            response_code: '200',
            source_domain: request.headers.host,
            event_time: new Date().toISOString(),
            event_version: '1'
        };

        assert.response(server, request, { status: 200 }, function (err, res) {
            if (err) {
                return done(err);
            }

            assert(fakeTopic.publish.calledOnceWith(Buffer.from('test-event'), eventAttributes));
            return done();
        });
    });
});
