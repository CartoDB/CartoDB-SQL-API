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

var argv = require('yargs')
    .usage('Usage: $0 <environment> [options]')
    .help('h')
    .example(
        '$0 production -c /etc/sql-api/config.js',
        'start server in production environment with /etc/sql-api/config.js as config file'
    )
    .alias('h', 'help')
    .alias('c', 'config')
    .nargs('c', 1)
    .describe('c', 'Load configuration from path')
    .argv;

var environmentArg = argv._[0] || process.env.NODE_ENV || 'development';
var configurationFile = path.resolve(argv.config || './config/environments/' + environmentArg + '.js');
if (!fs.existsSync(configurationFile)) {
    console.error('Configuration file "%s" does not exist', configurationFile);
    process.exit(1);
}

global.settings = require(configurationFile);
var ENVIRONMENT = argv._[0] || process.env.NODE_ENV || global.settings.environment;
process.env.NODE_ENV = ENVIRONMENT;

var availableEnvironments = ['development', 'production', 'test', 'staging'];

// sanity check arguments
if (availableEnvironments.indexOf(ENVIRONMENT) === -1) {
  console.error("node app.js [environment]");
  console.error("Available environments: " + availableEnvironments.join(', '));
  process.exit(1);
}

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
var listener = server.listen(global.settings.node_port, global.settings.node_host);
listener.on('listening', function() {
    console.info('Using configuration file "%s"', configurationFile);
    console.log(
        "CartoDB SQL API %s listening on %s:%s PID=%d (%s)",
        version, global.settings.node_host, global.settings.node_port, process.pid, ENVIRONMENT
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

    if (server.batch && server.batch.logger) {
        server.batch.logger.reopenFileStreams();
    }
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
