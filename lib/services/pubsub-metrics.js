'use strict';

const { PubSub } = require('@google-cloud/pubsub');

/**
 * PubSubMetricsService
 */
class PubSubMetricsService {
    static build () {
        if (!global.settings.pubSubMetrics || !global.settings.pubSubMetrics.enabled) {
            return new PubSubMetricsService(undefined, false);
        }

        const pubsub = PubSubMetricsService.createPubSub();

        return new PubSubMetricsService(pubsub, true);
    }

    static createPubSub () {
        const projectId = global.settings.pubSubMetrics.project_id;
        const credentials = global.settings.pubSubMetrics.credentials;
        const config = {};

        if (projectId) {
            config.projectId = projectId;
        }
        if (credentials) {
            config.keyFilename = credentials;
        }
        return new PubSub(config);
    }

    constructor (pubSub, enabled) {
        this.pubsub = pubSub;
        this.enabled = enabled;
    }

    isEnabled () {
        return this.enabled;
    }

    _getTopic () {
        const topicName = global.settings.pubSubMetrics.topic;

        return this.pubsub.topic(topicName);
    }

    sendEvent (event, attributes) {
        if (!this.enabled) {
            return;
        }

        const data = Buffer.from(event);
        const topic = this._getTopic();

        topic.publish(data, attributes)
            .then(() => {
                console.log(`PubSubTracker: event '${event}' published to '${topic.name}'`);
            })
            .catch((error) => {
                console.error(`ERROR: pubsub middleware failed to publish event '${event}': ${error.message}`);
            });
    }
}

module.exports = PubSubMetricsService;
