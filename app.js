#!/usr/bin/env node

/*
* SQL API loader
* ===============
*
* node app [environment] 
*
* environments: [development, test, production]
*
*/
var _ = require('underscore');

if ( process.argv[2] ) ENV = process.argv[2];
else if ( process.env['NODE_ENV'] ) ENV = process.env['NODE_ENV'];
else ENV = 'development';

process.env['NODE_ENV'] = ENV;

// sanity check arguments
if (ENV != 'development' && ENV != 'production' && ENV != 'test' && ENV != 'staging' ) {
  console.error("\nnode app.js [environment]");
  console.error("environments: development, staging, production, test");
  process.exit(1);
}

// set Node.js app settings and boot
global.settings  = require(__dirname + '/config/settings');
var env          = require(__dirname + '/config/environments/' + ENV);
_.extend(global.settings, env);

global.log4js = require('log4js')
log4js_config = {
  appenders: [
    { type: "console", layout: { type:'basic' } }
  ],
  replaceConsole:true
};

if ( global.settings.rollbar ) {
  log4js_config.appenders.push({
    type: __dirname + "/app/models/log4js_rollbar.js",
    options: global.settings.rollbar
  });
}

log4js.configure(log4js_config);
global.logger = log4js.getLogger();

 
// kick off controller
if ( ! global.settings.base_url ) global.settings.base_url = '/api/*';

var version = require("./package").version;

var app = require(global.settings.app_root + '/app/controllers/app')();
app.listen(global.settings.node_port, global.settings.node_host, function() {
  console.log("CartoDB SQL API " + version + " listening on " +
      global.settings.node_host + ":" + global.settings.node_port +
      " with base_url " + global.settings.base_url
      + " (" + ENV + ")");
});

process.on('uncaughtException', function(err) {
  logger.error('Uncaught exception: ' + err.stack);
});
