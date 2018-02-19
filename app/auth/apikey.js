/**
 * this module allows to auth user using an pregenerated api key
 */
function ApikeyAuth(req, apikey) {
    this.req = req;
    this.apikey = apikey;
}

module.exports = ApikeyAuth;

ApikeyAuth.prototype.verifyCredentials = function (options, callback) {
    callback(null, verifyRequest(this.apikey, options.apiKey));
};

ApikeyAuth.prototype.hasCredentials = function () {
    return !!this.apikey;
};

ApikeyAuth.prototype.getCredentials = function () {
    return this.apikey;
};

/**
 * Get id of authorized user
 *
 * @param {Object} req - standard req object. Importantly contains table and host information
 * @param {String} requiredApi - the API associated to the user, req must contain it
 * @param {Function} callback - err, boolean (whether the request is authenticated or not)
 */
function verifyRequest(apikey, requiredApikey) {
    return (apikey === requiredApikey);
}
