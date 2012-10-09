#!/usr/bin/env node

/*
* SQL API loader
* ===============
*
* node cluster [environment] 
*
* environments: [development, test, production]
*
*/
var _ = require('underscore');
var Cluster = require('cluster2');

// sanity check arguments
var ENV = process.argv[2];
if (ENV != 'development' && ENV != 'production' && ENV != 'staging') {
  console.error("\n./cluster [environment]");
  console.error("environments: [development, test, production, staging]");
  process.exit(1);
}

// set Node.js app settings and boot
global.settings  = require(__dirname + '/config/settings');
var env          = require(__dirname + '/config/environments/' + ENV);
_.extend(global.settings, env);
 
// kick off controller
var app = require(global.settings.app_root + '/app/controllers/app');

var cluster = new Cluster({
  port: global.settings.node_port,
  host: global.settings.node_host,
  monHost: global.settings.node_host,
  monPort: global.settings.node_port+1
});

cluster.listen(function(cb) {
  cb(app);
}, function() {
  console.log("CartoDB SQL API listening on " + global.settings.node_host + ':' + global.settings.node_port); 
});
