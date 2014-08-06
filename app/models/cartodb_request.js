/**
 * this module provides cartodb-specific interpretation
 * of request headers
 */

function CartodbRequest() {
}

module.exports = CartodbRequest;

CartodbRequest.prototype.userByReq = function(req) {
  var host = req.headers.host;
  var mat = host.match(re_userFromHost);
  if ( ! mat ) {
    console.error("ERROR: user pattern '" + re_userFromHost + "' does not match hostname '" + host + "'");
    return;
  }
  // console.log("Matches: "); console.dir(mat);
  if ( ! mat.length === 2 ) {
    console.error("ERROR: pattern '" + re_userFromHost + "' gave unexpected matches against '" + host + "': " + mat);
    return;
  }
  return mat[1];
};

var re_userFromHost = new RegExp(
    global.settings.user_from_host || '^([^\\.]+)\\.' // would extract "strk" from "strk.cartodb.com"
);
