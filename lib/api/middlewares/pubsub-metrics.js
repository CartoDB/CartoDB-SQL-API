'use strict';

const EVENT_VERSION = '1';

function pubSubMetrics (pubSubMetrics) {
    if (pubSubMetrics.isDisabled()) {
        return function pubSubMetricsDisabledMiddleware (req, res, next) { next(); };
    }

    return function pubSubMetricsMiddleware (req, res, next) {
        const [event, attributes] = getEventAttributes(req, res);

        if (!event) {
            return next();
        }

        pubSubMetrics.sendEvent(res.locals.user, event, attributes, next);
    };
}

function getEventAttributes (req, res) {
    const event = req.get('Carto-Event');
    const eventSource = req.get('Carto-Event-Source');
    const eventGroupId = req.get('Carto-Event-Group-Id');

    if (!event || !eventSource) {
        return [undefined, undefined];
    }

    const attributes = {
        event_source: eventSource,
        response_code: res.statusCode.toString(),
        source_domain: req.hostname,
        event_time: new Date().toISOString(),
        event_version: EVENT_VERSION
    };

    if (eventGroupId) {
        attributes.event_group_id = eventGroupId;
    }

    return [event, attributes];
}

module.exports = pubSubMetrics;
