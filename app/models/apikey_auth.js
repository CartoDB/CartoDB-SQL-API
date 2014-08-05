/**
 * this module allows to auth user using an pregenerated api key
 */
function ApikeyAuth() {
}

module.exports = ApikeyAuth;

/**
 * Get id of authorized user
 *
 * @param {Object} req - standard req object. Importantly contains table and host information
 * @param {String} requiredApi - the API associated to the user, req must contain it
 * @param {Function} callback - err, boolean (whether the request is authenticated or not)
 */
ApikeyAuth.prototype.verifyRequest = function (req, requiredApi, callback) {

    var valid = false;

    if ( requiredApi ) {
        if ( requiredApi == req.query.map_key ) {
            valid = true;
        } else if ( requiredApi == req.query.api_key ) {
            valid = true;
        // check also in request body
        } else if ( req.body && req.body.map_key && requiredApi == req.body.map_key ) {
            valid = true;
        } else if ( req.body && req.body.api_key && requiredApi == req.body.api_key ) {
            valid = true;
        }
    }

    callback(null, valid);
};
