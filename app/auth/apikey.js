/**
 * this module allows to auth user using an pregenerated api key
 */
function ApikeyAuth(req, res) {
    this.req = req;
    this.res = res;
}

module.exports = ApikeyAuth;

ApikeyAuth.prototype.verifyCredentials = function (options, callback) {
    callback(null, verifyRequest(this.res.locals.api_key, options.apiKey));
};

ApikeyAuth.prototype.hasCredentials = function () {
    return !!this.res.locals.api_key;
};

ApikeyAuth.prototype.getCredentials = function () {
    return this.res.locals.api_key;
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
