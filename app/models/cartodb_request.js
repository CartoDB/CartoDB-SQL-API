/**
 * this module provides cartodb-specific interpretation
 * of request headers
 */

function CartodbRequest() {
}

module.exports = CartodbRequest;

CartodbRequest.prototype.userByReq = function(req) {
    if (req.params.user) {
        return req.params.user;
    }
    return userByHostName(req.headers.host);
};

var re_userFromHost = new RegExp(
    global.settings.user_from_host || '^([^\\.]+)\\.' // would extract "strk" from "strk.cartodb.com"
);

function userByHostName(host) {
    var mat = host.match(re_userFromHost);
    if (!mat) {
        console.error("ERROR: user pattern '" + re_userFromHost + "' does not match hostname '" + host + "'");
        return;
    }

    if (mat.length !== 2) {
        console.error("ERROR: pattern '" + re_userFromHost + "' gave unexpected matches against '" + host + "': " + mat);
        return;
    }
    return mat[1];
}
