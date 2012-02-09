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
var cluster = require('cluster');

// sanity check arguments
var ENV = process.argv[2];
if (ENV != 'development' && ENV != 'production' && ENV != 'test' && ENV != 'staging') {
  console.error("\n./cluster [environment]");
  console.error("environments: [development, test, production, staging]");
  process.exit(1);
}

// set Node.js app settings and boot
global.settings  = require(__dirname + '/config/settings');
var env          = require(__dirname + '/config/environments/' + ENV);
_.extend(global.settings, env);
 
cluster('./app/controllers/app')
  .use(cluster.logger('logs'))
  .use(cluster.stats())
  .use(cluster.pidfiles('pids'))
  .listen(global.settings.node_port, global.settings.node_host);

console.log('CartoDB SQL-API running on port: ' + global.settings.node_port);
