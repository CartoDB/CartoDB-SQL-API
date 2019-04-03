#!/usr/bin/env node

'use strict';

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
const fqdn = require('@carto/fqdn-sync');

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

global.settings.api_hostname = fqdn.hostname();

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

var StatsClient = require('./app/stats/client');
if (global.settings.statsd) {
    // Perform keyword substitution in statsd
    if (global.settings.statsd.prefix) {
        global.settings.statsd.prefix = global.settings.statsd.prefix.replace(/:host/, fqdn.reverse());
    }
}
var statsClient = StatsClient.getInstance(global.settings.statsd);

var server = require('./app/server')(statsClient);
var listener = server.listen(global.settings.node_port, global.settings.node_host);
listener.on('listening', function() {
    console.info("Using Node.js %s", process.version);
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

    if (server.dataIngestionLogger) {
        server.dataIngestionLogger.reopenFileStreams();
    }
});

process.on('SIGTERM', function () {
    server.batch.stop(function (err) {
        if (err) {
            global.logger.fatal('On batch stop: ', err);
        }

        server.batch.drain(function (err) {
            if (err) {
                global.logger.fatal('On batch drain: ', err);
                return process.exit(1);
            }

            process.exit(0);
        });
    });
});

function isGteMinVersion(version, minVersion) {
    var versionMatch = /[a-z]?([0-9]*)/.exec(version);
    if (versionMatch) {
        var majorVersion = parseInt(versionMatch[1], 10);
        if (Number.isFinite(majorVersion)) {
            return majorVersion >= minVersion;
        }
    }
    return false;
}

setInterval(function memoryUsageMetrics () {
    let memoryUsage = process.memoryUsage();

    Object.keys(memoryUsage).forEach(property => {
        statsClient.gauge(`sqlapi.memory.${property}`, memoryUsage[property]);
    });
}, 5000);

function getCPUUsage (oldUsage) {
    let usage;

    if (oldUsage && oldUsage._start) {
        usage = Object.assign({}, process.cpuUsage(oldUsage._start.cpuUsage));
        usage.time = Date.now() - oldUsage._start.time;
    } else {
        usage = Object.assign({}, process.cpuUsage());
        usage.time = process.uptime() * 1000; // s to ms
    }

    usage.percent = (usage.system + usage.user) / (usage.time * 10);

    Object.defineProperty(usage, '_start', {
        value: {
            cpuUsage: process.cpuUsage(),
            time: Date.now()
        }
    });

    return usage;
}

let previousCPUUsage = getCPUUsage();
setInterval(function cpuUsageMetrics () {
    const CPUUsage = getCPUUsage(previousCPUUsage);

    Object.keys(CPUUsage).forEach(property => {
        statsClient.gauge(`sqlapi.cpu.${property}`, CPUUsage[property]);
    });

    previousCPUUsage = CPUUsage;
}, 5000);

if (global.gc && isGteMinVersion(process.version, 6)) {
    var gcInterval = Number.isFinite(global.settings.gc_interval) ?
        global.settings.gc_interval :
        10000;

    if (gcInterval > 0) {
        setInterval(function gcForcedCycle() {
            global.gc();
        }, gcInterval);
    }
}

const gcStats = require('gc-stats')();

gcStats.on('stats', function ({ pauseMS, gctype }) {
    statsClient.timing('sqlapi.gc', pauseMS);
    statsClient.timing(`sqlapi.gctype.${getGCTypeValue(gctype)}`, pauseMS);
});

function getGCTypeValue (type) {
    // 1: Scavenge (minor GC)
    // 2: Mark/Sweep/Compact (major GC)
    // 4: Incremental marking
    // 8: Weak/Phantom callback processing
    // 15: All
    let value;

    switch (type) {
        case 1:
            value = 'Scavenge';
            break;
        case 2:
            value = 'MarkSweepCompact';
            break;
        case 4:
            value = 'IncrementalMarking';
            break;
        case 8:
            value = 'ProcessWeakCallbacks';
            break;
        case 15:
            value = 'All';
            break;
        default:
            value = 'Unkown';
            break;
    }

    return value;
}
