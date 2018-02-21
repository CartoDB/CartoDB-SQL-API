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

function verifyRequest(apikey, requiredApikey) {
    return (apikey === requiredApikey && apikey !== 'default_public');
}
