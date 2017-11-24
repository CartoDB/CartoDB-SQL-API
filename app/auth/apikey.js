/**
 * this module allows to auth user using an pregenerated api key
 */
function ApikeyAuth(req) {
    this.req = req;
}

module.exports = ApikeyAuth;

ApikeyAuth.prototype.verifyCredentials = function(options, callback) {
    verifyRequest(this.req, options.apiKey, callback);
};

ApikeyAuth.prototype.hasCredentials = function() {
    return !!(this.req.query.api_key || this.req.query.map_key ||
        (this.req.body && this.req.body.api_key) || (this.req.body && this.req.body.map_key));
};

ApikeyAuth.prototype.getCredentials = function() {
    if  (this.req.query.api_key) {
        return this.req.query.api_key;
    }
    if (this.req.query.map_key) {
        return this.req.query.map_key;
    }
    if (this.req.body && this.req.body.api_key) {
        return this.req.body.api_key;
    }
    if (this.req.body && this.req.body.map_key) {
        return this.req.body.map_key;
    }
};

/**
 * Get id of authorized user
 *
 * @param {Object} req - standard req object. Importantly contains table and host information
 * @param {String} requiredApi - the API associated to the user, req must contain it
 * @param {Function} callback - err, boolean (whether the request is authenticated or not)
 */
function verifyRequest(req, requiredApi, callback) {

    var valid = false;

    if ( requiredApi ) {
        if ( requiredApi === req.query.map_key ) {
            valid = true;
        } else if ( requiredApi === req.query.api_key ) {
            valid = true;
        // check also in request body
        } else if ( req.body && req.body.map_key && requiredApi === req.body.map_key ) {
            valid = true;
        } else if ( req.body && req.body.api_key && requiredApi === req.body.api_key ) {
            valid = true;
        }
    }

    callback(null, valid);
}
