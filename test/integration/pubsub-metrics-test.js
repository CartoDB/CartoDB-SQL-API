'use strict';

require('../helper');

const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const qs = require('querystring');
const assert = require('../support/assert');
const app = require('../../lib/server');
const PubSubMetricsService = require('../../lib/services/pubsub-metrics');

const queryRequest = {
    url: '/api/v1/sql?' + qs.stringify({
        q: 'SELECT * FROM untitle_table_4'
    }),
    headers: {
        host: 'vizzuality.cartodb.com',
        'Carto-Event': 'test-event',
        'Carto-Event-Source': 'test',
        'Carto-Event-Group-Id': '1'
    },
    method: 'GET'
};

const copyRequest = {
    url: '/api/v1/sql/copyfrom?' + qs.stringify({
        q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
    }),
    data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
    headers: {
        host: 'vizzuality.cartodb.com',
        'Carto-Event': 'test-event',
        'Carto-Event-Source': 'test',
        'Carto-Event-Group-Id': '1'
    },
    method: 'POST'
};

const jobRequest = {
    url: '/api/v1/sql/job/wadus',
    headers: {
        host: 'vizzuality.cartodb.com',
        'Carto-Event': 'test-event',
        'Carto-Event-Source': 'test',
        'Carto-Event-Group-Id': '1'
    },
    method: 'GET'
};

const nonMetricsHeadersRequest = {
    url: '/api/v1/sql?' + qs.stringify({
        q: 'SELECT * FROM untitle_table_4'
    }),
    headers: {
        host: 'vizzuality.cartodb.com'
    },
    method: 'GET'
};

const badRequest = {
    url: '/api/v1/sql?',
    headers: {
        host: 'vizzuality.cartodb.com',
        'Carto-Event': 'test-event',
        'Carto-Event-Source': 'test',
        'Carto-Event-Group-Id': '1'
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

function buildEventAttributes (host, statusCode) {
    return {
        event_source: 'test',
        user_id: '1',
        event_group_id: '1',
        response_code: statusCode.toString(),
        source_domain: host,
        event_time: new Date().toISOString(),
        event_version: '1'
    };
}

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

        assert.response(server, queryRequest, { status: 200 }, function (err) {
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

        assert.response(server, nonMetricsHeadersRequest, { status: 200 }, function (err) {
            if (err) {
                return done(err);
            }

            assert(fakeTopic.publish.notCalled);
            return done();
        });
    });

    xit('should send event for query requests', function (done) {
        global.settings.pubSubMetrics.enabled = true;
        server = app();

        const statusCode = 200;
        const eventAttributes = buildEventAttributes(queryRequest.headers.host, statusCode);

        assert.response(server, queryRequest, { status: statusCode }, function (err) {
            if (err) {
                return done(err);
            }

            assert(fakeTopic.publish.calledOnceWith(Buffer.from('test-event'), eventAttributes));
            return done();
        });
    });

    it('should send event for copy requests', function (done) {
        global.settings.pubSubMetrics.enabled = true;
        server = app();

        const statusCode = 200;
        const eventAttributes = buildEventAttributes(copyRequest.headers.host, statusCode);

        assert.response(server, copyRequest, { status: statusCode }, function (err) {
            if (err) {
                return done(err);
            }

            assert(fakeTopic.publish.calledOnceWith(Buffer.from('test-event'), eventAttributes));
            return done();
        });
    });

    it('should send event for job requests', function (done) {
        global.settings.pubSubMetrics.enabled = true;
        server = app();

        const statusCode = 200;
        const eventAttributes = buildEventAttributes(jobRequest.headers.host, statusCode);

        assert.response(server, queryRequest, { status: statusCode }, function (err) {
            if (err) {
                return done(err);
            }

            assert(fakeTopic.publish.calledOnceWith(Buffer.from('test-event'), eventAttributes));
            return done();
        });
    });

    xit('should send event when error', function (done) {
        global.settings.pubSubMetrics.enabled = true;
        server = app();

        const statusCode = 400;
        const eventAttributes = buildEventAttributes(badRequest.headers.host, statusCode);

        assert.response(server, badRequest, { status: statusCode }, function (err) {
            if (err) {
                return done(err);
            }

            assert(fakeTopic.publish.calledOnceWith(Buffer.from('test-event'), eventAttributes));
            return done();
        });
    });
});