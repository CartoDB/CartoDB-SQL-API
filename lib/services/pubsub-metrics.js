'use strict';

const {PubSub} = require('@google-cloud/pubsub');

/**
 * PubSubMetricsService
 * @param {cartodb-redis} metadataBackend
 */
class PubSubMetricsService {

    constructor (metadataBackend) {
        this.metadataBackend = metadataBackend;

        let topicName = global.settings.pubSubMetrics.topic;
        console.log(`TopicName: '${topicName}'`);

        if (topicName !== undefined) {
            this.pubsub = this.initPubSub();
            this.topic = this.pubsub.topic(topicName);
            console.log(`Topic retrieved: '${this.topic.name}'`)
        }
    }

    initPubSub() {
        let projectId = global.settings.pubSubMetrics.project_id;
        let credentials = global.settings.pubSubMetrics.credentials;

        let config = {};

        if (projectId) {
            config['projectId'] = projectId;
        }

        if (credentials) {
            config['keyFilename'] = credentials;
        }

        return new PubSub(config);
    }

    isEnabled() {
        return this.pubsub !== undefined && this.topic !== undefined;
    }

    sendEvent (username, event, attributes, callback) {
        if (!this.isEnabled()) {
            console.log('PubSub not enabled!!');
            return callback;
        }

        let self = this;

        self.metadataBackend.getUserId(username, function (err, userId) {
            if (err) {
                global.logger.log(`ERROR: failed to obtain user id with username '${username}': ${err.message}`);
                console.log(`ERROR: failed to obtain user id with username '${username}': ${err.message}`);
                return callback(err);
            }

            attributes['user_id'] = userId;
            let data = Buffer.from(event);

            self.topic.publish(data, attributes)
                .then(() => {
                    global.logger.log(`PubSubTracker: event '${event}' published to '${self.topic.name}'`);
                    console.log(`PubSubTracker: event '${event}' published to '${self.topic.name}'`);
                })
                .catch((error) => {
                    global.logger.log(`ERROR: pubsub failed to publish event '${event}': ${error.message}`);
                    console.log(`ERROR: pubsub failed to publish event '${event}': ${error.message}`);
                });

            return callback();
        });
    }
}

module.exports = PubSubMetricsService;
