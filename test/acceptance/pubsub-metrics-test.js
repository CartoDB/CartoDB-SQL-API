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

describe('pubsub metrics middleware', function () {
    let server;
    let isDisabledStub;
    let sendStub;
    let clock;

    before(function () {
        clock = sinon.useFakeTimers();
        isDisabledStub = sinon.stub(PubSubMetricsService.prototype, 'isDisabled');
        sendStub = sinon.stub(PubSubMetricsService.prototype, 'sendEvent');
        server = app();
    });

    after(function () {
        clock.restore();
        PubSubMetricsService.prototype.isDisabled.restore();
        PubSubMetricsService.prototype.sendEvent.restore();
    });

    it('should not send event if disabled', function (done) {
        isDisabledStub.returns(true);

        assert.response(server, request, { status: 200 }, function (err, res) {
            if (err) {
                return done(err);
            }

            assert(sendStub.notCalled);
            done();
        });
    });

    it('should not send event if headers not present', function (done) {
        isDisabledStub.returns(false);

        assert.response(server, request, { status: 200 }, function (err, res) {
            if (err) {
                return done(err);
            }

            assert(sendStub.notCalled);
            done();
        });
    });

    it('should send event if headers present', function (done) {
        isDisabledStub.returns(false);
        request.headers['Carto-Event'] = 'test-event';
        request.headers['Carto-Event-Source'] = 'test';
        request.headers['Carto-Event-Group-Id'] = '1';

        const eventAttributes = {
            event_source: 'test',
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

            assert(sendStub.calledOnceWith('vizzuality', 'test-event', eventAttributes, sinon.match.any));
            done();
        });
    });
});
