#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const fqdn = require('@carto/fqdn-sync');
const serverOptions = require('./lib/server-options');
const { logger } = serverOptions();

const argv = require('yargs')
    .usage('Usage: node $0 <environment> [options]')
    .help('h')
    .example(
        'node $0 production -c /etc/sql-api/config.js',
        'start server in production environment with /etc/sql-api/config.js as config file'
    )
    .alias('h', 'help')
    .alias('c', 'config')
    .nargs('c', 1)
    .describe('c', 'Load configuration from path')
    .argv;

let environmentArg = argv._[0] || process.env.NODE_ENV || 'development';
if (process.env.CARTO_SQL_API_ENV_BASED_CONF) {
    // we override the file with the one with env vars
    environmentArg = 'config';
}
const configurationFile = path.resolve(argv.config || './config/environments/' + environmentArg + '.js');

if (!fs.existsSync(configurationFile)) {
    logger.fatal(new Error(`Configuration file "${configurationFile}" does not exist`));
    process.exit(1);
}
global.settings = require(configurationFile);

const ENVIRONMENT = argv._[0] || process.env.NODE_ENV || global.settings.environment;
process.env.NODE_ENV = ENVIRONMENT;

const availableEnvironments = ['development', 'production', 'test', 'staging'];

if (!availableEnvironments.includes(ENVIRONMENT)) {
    logger.fatal(new Error(`Invalid environment ${ENVIRONMENT} argument, valid ones: ${Object.values(availableEnvironments).join(', ')}`));
    process.exit(1);
}

global.settings.api_hostname = fqdn.hostname();

const StatsClient = require('./lib/stats/client');

if (global.settings.statsd) {
    // Perform keyword substitution in statsd
    if (global.settings.statsd.prefix) {
        global.settings.statsd.prefix = global.settings.statsd.prefix.replace(/:host/, fqdn.reverse());
    }
}
const statsClient = StatsClient.getInstance(global.settings.statsd);

const { version, name } = require('./package');
const createServer = require('./lib/server');

const server = createServer(statsClient);

const listener = server.listen(global.settings.node_port, global.settings.node_host);
listener.on('listening', function () {
    const { address, port } = listener.address();
    logger.info({ 'Node.js': process.version, pid: process.pid, environment: process.env.NODE_ENV, [name]: version, address, port, config: configurationFile }, `${name} initialized successfully`);
});

process.on('uncaughtException', function (err) {
    logger.error(err, 'Uncaught exception');
});

const exitProcess = logger.finish((err, finalLogger, listener, signal, killTimeout) => {
    scheduleForcedExit(killTimeout, finalLogger);

    finalLogger.info(`Process has received signal: ${signal}`);

    let code = 0;

    if (err) {
        code = 1;
        finalLogger.fatal(err);
    }

    finalLogger.info(`Process is going to exit with code: ${code}`);
    listener.close(() => process.exit(code));

    listener.close(() => {
        server.batch.stop(() => {
            server.batch.drain((err) => {
                if (err) {
                    finalLogger.error(err);
                    return process.exit(1);
                }

                process.exit(code);
            });
        });
    });
});

function addHandlers (listener, killTimeout) {
    // FIXME: minimize the number of 'uncaughtException' before uncomment the following line
    // process.on('uncaughtException', (err) => exitProcess(err, listener, 'uncaughtException', killTimeout));
    process.on('unhandledRejection', (err) => exitProcess(err, listener, 'unhandledRejection', killTimeout));
    process.on('ENOMEM', (err) => exitProcess(err, listener, 'ENOMEM', killTimeout));
    process.on('SIGINT', () => exitProcess(null, listener, 'SIGINT', killTimeout));
    process.on('SIGTERM', () => exitProcess(null, listener, 'SIGINT', killTimeout));
}

addHandlers(listener, 45000);

function scheduleForcedExit (killTimeout, finalLogger) {
    // Schedule exit if there is still ongoing work to deal with
    const killTimer = setTimeout(() => {
        finalLogger.info('Process didn\'t close on time. Force exit');
        process.exit(1);
    }, killTimeout);

    // Don't keep the process open just for this
    killTimer.unref();
}

const regex = /[a-z]?([0-9]*)/;
function isGteMinVersion (version, minVersion) {
    const versionMatch = regex.exec(version);
    if (versionMatch) {
        const majorVersion = parseInt(versionMatch[1], 10);
        if (Number.isFinite(majorVersion)) {
            return majorVersion >= minVersion;
        }
    }
    return false;
}

setInterval(function memoryUsageMetrics () {
    const memoryUsage = process.memoryUsage();

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
    const gcInterval = Number.isFinite(global.settings.gc_interval)
        ? global.settings.gc_interval
        : 10000;

    if (gcInterval > 0) {
        setInterval(function gcForcedCycle () {
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
