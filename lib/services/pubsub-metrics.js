'use strict';

const { PubSub } = require('@google-cloud/pubsub');

/**
 * PubSubMetricsService
 * @param {cartodb-redis} metadataBackend
 */
class PubSubMetricsService {
    constructor (metadataBackend) {
        this.metadataBackend = metadataBackend;

        this.topicName = global.settings.pubSubMetrics.topic;

        if (this.topicName) {
            this.pubsub = this.initPubSub();
            this.topic = this.getTopic();
        }
    }

    initPubSub () {
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

    getTopic () {
        if (!this.topic) {
            this.topic = this.pubsub.topic(this.topicName);
        }

        return this.topic;
    }

    isDisabled () {
        return this.pubsub === undefined || this.topic === undefined;
    }

    publish (event, attributes) {
        const data = Buffer.from(event);

        this.topic.publish(data, attributes)
            .then(() => {
                // global.logger.log(`PubSubTracker: event '${event}' published to '${self.topic.name}'`);
                console.log(`PubSubTracker: event '${event}' published to '${this.topic.name}'`);
            })
            .catch((error) => {
                // global.logger.log(`ERROR: pubsub failed to publish event '${event}': ${error.message}`);
                console.log(`ERROR: pubsub failed to publish event '${event}': ${error.message}`);
            });
    }

    sendEvent (username, event, attributes, callback) {
        if (this.isDisabled()) {
            return callback();
        }

        const self = this;

        self.metadataBackend.getUserId(username, function (err, userId) {
            if (err) {
                // global.logger.log(`ERROR: failed to obtain user id with username '${username}': ${err.message}`);
                return callback(err);
            }

            attributes.user_id = userId;
            self.publish(event, attributes);

            return callback();
        });
    }
}

module.exports = PubSubMetricsService;
