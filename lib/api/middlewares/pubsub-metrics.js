'use strict';

const EVENT_VERSION = 1;

function pubSubMetrics(pubSubMetrics) {
    if (pubSubMetrics.isDisabled()) {
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
    let event = req.get('Carto-Event');
    let eventSource = req.get('Carto-Event-Source');
    let eventGroupId = req.get('Carto-Event-Group-Id');

    if (!event || !eventSource) {
        return [undefined, undefined]
    }

    let attributes = {
        event_source: eventSource,
        response_code: res.statusCode.toString(),
        event_time: new Date().toISOString(),
        event_version: EVENT_VERSION
    };

    if (eventGroupId) {
        attributes['event_group_id'] = eventGroupId;
    }

    return [event, attributes];
}

module.exports = pubSubMetrics;
