'use strict';

/**
 * this module provides cartodb-specific interpretation
 * of request headers
 */

function CartodbRequest () {
}

module.exports = CartodbRequest;

/**
 * If the request contains the user use it, if not guess from the host
 */
CartodbRequest.prototype.userByReq = function (req) {
    if (req.params.user) {
        return req.params.user;
    }
    return userByHostName(req.headers.host);
};

var userFromHostRegex = new RegExp(
    global.settings.user_from_host || '^([^\\.]+)\\.' // would extract "strk" from "strk.cartodb.com"
);

function userByHostName (host) {
    var mat = host.match(userFromHostRegex);
    if (!mat) {
        console.error("ERROR: user pattern '" + userFromHostRegex + "' does not match hostname '" + host + "'");
        return;
    }

    if (mat.length !== 2) {
        console.error(
            "ERROR: pattern '" + userFromHostRegex + "' gave unexpected matches against '" + host + "': " + mat
        );
        return;
    }
    return mat[1];
}
