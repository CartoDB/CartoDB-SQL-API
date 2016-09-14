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
var fs = require('fs');
var path = require('path');

var ENV = process.env.NODE_ENV || 'development';

if (process.argv[2]) {
    ENV = process.argv[2];
}

process.env.NODE_ENV = ENV;

var availableEnvironments = ['development', 'production', 'test', 'staging'];

// sanity check arguments
if (availableEnvironments.indexOf(ENV) === -1) {
  console.error("\nnode app.js [environment]");
  console.error("environments: " + availableEnvironments.join(', '));
  process.exit(1);
}

// set Node.js app settings and boot
global.settings = require('./config/environments/' + ENV);
global.settings.api_hostname = require('os').hostname().split('.')[0];

global.log4js = require('log4js');
var log4jsConfig = {
    appenders: [],
    replaceConsole: true
};

if ( global.settings.log_filename ) {
    var logFilename = path.resolve(global.settings.log_filename);
    var logDirectory = path.dirname(logFilename);
    if (!fs.existsSync(logDirectory)) {
        console.error("Log filename directory does not exist: " + logDirectory);
        process.exit(1);
    }
    console.log("Logs will be written to " + logFilename);
    log4jsConfig.appenders.push(
        { type: "file", absolute: true, filename: logFilename }
    );
} else {
    log4jsConfig.appenders.push(
        { type: "console", layout: { type:'basic' } }
    );
}
global.log4js.configure(log4jsConfig);
global.logger = global.log4js.getLogger();


// kick off controller
if ( ! global.settings.base_url ) {
    global.settings.base_url = '/api/*';
}

var version = require("./package").version;

var server = require('./app/server')();
server.listen(global.settings.node_port, global.settings.node_host, function() {
  console.log(
      "CartoDB SQL API %s listening on %s:%s with base_url %s PID=%d (%s)",
      version, global.settings.node_host, global.settings.node_port, global.settings.base_url, process.pid, ENV
  );
});

process.on('uncaughtException', function(err) {
    global.logger.error('Uncaught exception: ' + err.stack);
});

process.on('SIGHUP', function() {
    global.log4js.clearAndShutdownAppenders(function() {
        global.log4js.configure(log4jsConfig);
        global.logger = global.log4js.getLogger();
        console.log('Log files reloaded');
    });
});

process.on('SIGTERM', function () {
    server.batch.stop();
    server.batch.drain(function (err) {
        if (err) {
            console.log('Exit with error');
            return process.exit(1);
        }

        console.log('Exit gracefully');
        process.exit(0);
    });
});
