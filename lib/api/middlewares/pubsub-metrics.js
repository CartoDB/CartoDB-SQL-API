'use strict';

const EVENT_VERSION = 1;

function pubSubMetrics(pubSubMetrics) {
    if (!pubSubMetrics.isEnabled()) {
        console.log('*** Metrics not enabled');
        return function pubSubMetricsDisabledMiddleware(req, res, next) { next(); };
    }

    console.log('*** Metrics enabled');
    return function pubSubMetricsMiddleware(req, res, next) {
        let [event, attributes] = getEventAttributes(req, res);

        if(!event) {
            return next();
        }

        pubSubMetrics.sendEvent(res.locals.user, event, attributes, next);
    };
}

function getEventAttributes(req, res) {
    let event = req.get('Carto-Source-Context');
    let eventSource = req.get('Carto-Source-Lib');
    let eventId = req.get('Carto-Source-Context-Id');

    if (!event || !eventSource) {
        return [undefined, undefined]
    }

    let attributes = {
        event_source: eventSource,
        response_code: res.statusCode.toString(),
        event_time: new Date().toISOString(),
        event_version: EVENT_VERSION
    };

    if (eventId) {
        attributes['event_id'] = eventId;
    }

    return [event, attributes];
}

module.exports = pubSubMetrics;
