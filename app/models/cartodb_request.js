/**
 * this module provides cartodb-specific interpretation
 * of request headers
 */

function CartodbRequest() {
}

module.exports = CartodbRequest;

CartodbRequest.prototype.userByReq = function(req) {
  var host = req.headers.host;
  return global.settings.db_user;
};

var re_userFromHost = new RegExp(
    global.settings.user_from_host || '^([^\\.]+)\\.' // would extract "strk" from "strk.cartodb.com"
);
