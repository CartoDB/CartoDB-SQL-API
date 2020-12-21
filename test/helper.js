'use strict';

let configFileName = process.env.NODE_ENV;
if (process.env.CARTO_SQL_API_ENV_BASED_CONF) {
    // we override the file with the one with env vars
    configFileName = 'config';
}

global.settings = require(`../config/environments/${configFileName}.js`);
process.env.NODE_ENV = 'test';
