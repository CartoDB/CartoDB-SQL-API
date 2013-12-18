/**
 * this module provides cartodb-specific interpretation
 * of request headers
 */

function CartodbRequest(cartodb_redis) {
  this.cartodb_redis = cartodb_redis;
}

module.exports = CartodbRequest;

var o = CartodbRequest.prototype;

o.re_userFromHost = new RegExp(
  global.settings.user_from_host ||
  '^([^\\.]+)\\.' // would extract "strk" from "strk.cartodb.com"
);

o.userByReq = function(req) {
  var host = req.headers.host;
  var mat = host.match(this.re_userFromHost);
  if ( ! mat ) {
    console.error("ERROR: user pattern '" + this.re_userFromHost
      + "' does not match hostname '" + host + "'");
    return;
  }
  // console.log("Matches: "); console.dir(mat);
  if ( ! mat.length === 2 ) {
    console.error("ERROR: pattern '" + this.re_userFromHost
      + "' gave unexpected matches against '" + host + "': " + mat);
    return;
  }
  return mat[1];
};

