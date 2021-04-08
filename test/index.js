'use strict';

const redis = require('redis');
const pg = require('pg');
const fs = require('fs').promises;

if (!process.env.NODE_ENV) {
    console.error('Please set "NODE_ENV" variable, e.g.: "NODE_ENV=test"');
    process.exit(1);
}
let configFileName = process.env.NODE_ENV;
if (process.env.CARTO_SQL_API_ENV_BASED_CONF) {
    // we override the file with the one with env vars
    configFileName = 'config';
}

const environment = require(`../config/environments/${configFileName}.js`);
const REDIS_PORT = environment.redis_port;
const REDIS_HOST = environment.redis_host;
const PGHOST = environment.db_host;
const PGPORT = environment.db_port;

const TEST_USER_ID = 1;
const TEST_USER = environment.db_user.replace('<%= user_id %>', TEST_USER_ID);
const TEST_PASSWORD = environment.db_user_pass.replace('<%= user_id %>', TEST_USER_ID);
const PUBLIC_USER = environment.db_pubuser;
const PUBLIC_USER_PASSWORD = environment.db_pubuser_pass;
const TEST_DB = environment.db_base_name.replace('<%= user_id %>', TEST_USER_ID);

async function query ({ db = 'postgres', sql }) {
    const client = new pg.Client({
        host: PGHOST,
        port: PGPORT,
        user: 'postgres',
        database: db
    });

    await new Promise((resolve, reject) => client.connect((err) => err ? reject(err) : resolve()));
    const res = await new Promise((resolve, reject) => client.query(sql, (err, res) => err ? reject(err) : resolve(res)));
    await new Promise((resolve, reject) => client.end((err) => err ? reject(err) : resolve()));

    return res;
}

async function dropDatabase () {
    await query({ sql: `DROP DATABASE IF EXISTS ${TEST_DB}` });
}

async function createDatabase () {
    await query({ sql: `CREATE DATABASE ${TEST_DB} TEMPLATE template_postgis ENCODING UTF8` });
}

async function createDatabaseExtension () {
    await query({ db: TEST_DB, sql: 'CREATE EXTENSION IF NOT EXISTS cartodb CASCADE' });
}

async function currentSearchPath () {
    const res = await query({ db: TEST_DB, sql: 'SELECT current_setting(\'search_path\')' });
    return res.rows[0].current_setting;
}

async function populateDatabase () {
    const searchPath = await currentSearchPath();

    const filenames = [
        'test',
        'populated_places_simple_reduced',
        'quota_mock'
    ].map(filename => `${__dirname}/support/sql/${filename}.sql`);

    for (const filename of filenames) {
        const content = await fs.readFile(filename, 'utf-8');
        const sql = content
            .replace(/:SEARCHPATH/g, searchPath)
            .replace(/:PUBLICUSER/g, PUBLIC_USER)
            .replace(/:PUBLICPASS/g, PUBLIC_USER_PASSWORD)
            .replace(/:TESTUSER/g, TEST_USER)
            .replace(/:TESTPASS/g, TEST_PASSWORD);

        await query({ db: TEST_DB, sql });
    }
}

async function vacuumAnalyze () {
    const tables = [
        'populated_places_simple_reduced',
        'untitle_table_4',
        'scoped_table_1',
        'private_table',
        'cpg_test',
        'copy_endpoints_test',
        'pgtypes_table'
    ];
    await query({ db: TEST_DB, sql: `VACUUM ANALYZE ${tables.join(', ')}` });
}

async function populateRedis () {
    const client = redis.createClient({ host: REDIS_HOST, port: REDIS_PORT, db: 5 });

    const commands = client.multi()
        .hmset('rails:users:vizzuality', [
            'id', TEST_USER_ID,
            'database_name', TEST_DB,
            'database_host', PGHOST,
            'map_key', '1234'
        ])
        .hmset('rails:users:cartodb250user', [
            'id', TEST_USER_ID,
            'database_name', TEST_DB,
            'database_host', PGHOST,
            'database_password', TEST_PASSWORD,
            'map_key', '1234'
        ])
        .hmset('api_keys:vizzuality:1234', [
            'user', 'vizzuality',
            'type', 'master',
            'grants_sql', 'true',
            'database_role', TEST_USER,
            'database_password', TEST_PASSWORD
        ])
        .hmset('api_keys:vizzuality:default_public', [
            'user', 'vizzuality',
            'type', 'default',
            'grants_sql', 'true',
            'database_role', PUBLIC_USER,
            'database_password', PUBLIC_USER_PASSWORD
        ])
        .hmset('api_keys:vizzuality:regular1', [
            'user', 'vizzuality',
            'type', 'regular',
            'grants_sql', 'true',
            'database_role', 'regular_1',
            'database_password', 'regular1'
        ])
        .hmset('api_keys:vizzuality:regular2', [
            'user', 'vizzuality',
            'type', 'regular',
            'grants_sql', 'true',
            'database_role', 'regular_2',
            'database_password', 'regular2'
        ])
        .hmset('api_keys:cartodb250user:1234', [
            'user', 'cartodb250user',
            'type', 'master',
            'grants_sql', 'true',
            'database_role', TEST_USER,
            'database_password', TEST_PASSWORD
        ])
        .hmset('api_keys:cartodb250user:default_public', [
            'user', 'cartodb250user',
            'type', 'default',
            'grants_sql', 'true',
            'database_role', PUBLIC_USER,
            'database_password', PUBLIC_USER_PASSWORD
        ]);

    await new Promise((resolve, reject) => commands.exec((err) => err ? reject(err) : resolve()));

    client.select('3');

    const oauthCommands = client.multi()
        .hmset('rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR', [
            'consumer_key', 'fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2',
            'consumer_secret', 'IBLCvPEefxbIiGZhGlakYV4eM8AbVSwsHxwEYpzx',
            'access_token_token', 'l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR',
            'access_token_secret', '22zBIek567fMDEebzfnSdGe8peMFVFqAreOENaDK',
            'user_id', TEST_USER_ID,
            'time', 'sometime'
        ]);

    await new Promise((resolve, reject) => oauthCommands.exec((err) => err ? reject(err) : resolve()));
    await new Promise((resolve, reject) => client.quit((err) => err ? reject(err) : resolve()));
}

async function unpopulateRedis () {
    const client = redis.createClient({ host: REDIS_HOST, port: REDIS_PORT, db: 5 });

    const commands = client.multi()
        .del('rails:users:vizzuality')
        .del('rails:users:cartodb250user')
        .del('api_keys:vizzuality:1234')
        .del('api_keys:vizzuality:default_public')
        .del('api_keys:vizzuality:regular1')
        .del('api_keys:vizzuality:regular2')
        .del('api_keys:cartodb250user:1234')
        .del('api_keys:cartodb250user:default_public')
        .del('rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR');

    await new Promise((resolve, reject) => commands.exec((err) => err ? reject(err) : resolve()));
    await new Promise((resolve, reject) => client.quit((err) => err ? reject(err) : resolve()));
}

async function main (args) {
    let code = 0;

    try {
        switch (args[0]) {
        case 'setup':
            await unpopulateRedis();
            await populateRedis();
            await dropDatabase();
            await createDatabase();
            await createDatabaseExtension();
            await populateDatabase();
            await vacuumAnalyze();
            break;
        case 'teardown':
            await unpopulateRedis();
            await dropDatabase();
            break;
        default:
            throw new Error('Missing "mode" argument. Valid ones: "setup" or "teardown"');
        }
    } catch (err) {
        console.error(err);
        code = 1;
    } finally {
        process.exit(code);
    }
}

main(process.argv.slice(2));
