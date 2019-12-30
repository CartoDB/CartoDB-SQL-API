'use strict';

const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);

if (!process.env.NODE_ENV) {
    console.error('Please set "NODE_ENV" variable, e.g.: "NODE_ENV=test"');
    process.exit(1);
}

const environment = require(`../config/environments/${process.env.NODE_ENV}.js`);
const REDIS_PORT = environment.redis_port;
const REDIS_CELL_PATH = path.resolve(
    process.platform === 'darwin'
        ? './test/support/libredis_cell.dylib'
        : './test/support/libredis_cell.so'
);

const TEST_USER_ID = 1;
const TEST_USER = environment.db_user.replace('<%= user_id %>', TEST_USER_ID);
const TEST_PASSWORD = environment.db_user_pass.replace('<%= user_id %>', TEST_USER_ID);
const PUBLIC_USER = environment.db_pubuser;
const PUBLIC_USER_PASSWORD = environment.db_pubuser_pass;
const TEST_DB = environment.db_base_name.replace('<%= user_id %>', TEST_USER_ID);
const PGHOST = environment.db_host;

async function startRedis () {
    await exec(`redis-server --port ${REDIS_PORT} --loadmodule ${REDIS_CELL_PATH} --logfile ${__dirname}/redis-server.log --daemonize yes`);
}

async function stopRedis () {
    await exec(`redis-cli -p ${REDIS_PORT} shutdown`);
}

async function dropDatabase () {
    await exec(`dropdb --if-exists ${TEST_DB}`, {
        env: Object.assign({ PGUSER: 'postgres' }, process.env)
    });
}

async function createDatabase () {
    await exec(`createdb -T template_postgis -EUTF8 "${TEST_DB}"`, {
        env: Object.assign({ PGUSER: 'postgres' }, process.env)
    });
}

async function createDatabaseExtension () {
    await exec(`psql -c "CREATE EXTENSION IF NOT EXISTS cartodb CASCADE;" ${TEST_DB}`, {
        env: Object.assign({ PGUSER: 'postgres' }, process.env)
    });
}

async function populateDatabase () {
    const filenames = [
        'test',
        'populated_places_simple_reduced',
        'py_sleep',
        'quota_mock'
    ].map(filename => `${__dirname}/support/sql/${filename}.sql`);

    const populateDatabaseCmd = `
        cat ${filenames.join(' ')} |
        sed -e "s/:PUBLICUSER/${PUBLIC_USER}/g" |
        sed -e "s/:PUBLICPASS/${PUBLIC_USER_PASSWORD}/g" |
        sed -e "s/:TESTUSER/${TEST_USER}/g" |
        sed -e "s/:TESTPASS/${TEST_PASSWORD}/g" |
        PGOPTIONS='--client-min-messages=WARNING' psql -q -v ON_ERROR_STOP=1 ${TEST_DB}
    `;

    await exec(populateDatabaseCmd, {
        env: Object.assign({ PGUSER: 'postgres' }, process.env)
    });
}

async function populateRedis () {
    const commands = `
        HMSET rails:users:vizzuality \
            id ${TEST_USER_ID} \
            database_name "${TEST_DB}" \
            database_host "${PGHOST}" \
            map_key 1234

        HMSET rails:users:cartodb250user \
            id ${TEST_USER_ID} \
            database_name "${TEST_DB}" \
            database_host "${PGHOST}" \
            database_password "${TEST_PASSWORD}" \
            map_key 1234

        HMSET api_keys:vizzuality:1234 \
            user "vizzuality" \
            type "master" \
            grants_sql "true" \
            database_role "${TEST_USER}" \
            database_password "${TEST_PASSWORD}"

        HMSET api_keys:vizzuality:default_public \
            user "vizzuality" \
            type "default" \
            grants_sql "true" \
            database_role "${PUBLIC_USER}" \
            database_password "${PUBLIC_USER_PASSWORD}"

        HMSET api_keys:vizzuality:regular1 \
            user "vizzuality" \
            type "regular" \
            grants_sql "true" \
            database_role "regular_1" \
            database_password "regular1"

        HMSET api_keys:vizzuality:regular2 \
            user "vizzuality" \
            type "regular" \
            grants_sql "true" \
            database_role "regular_2" \
            database_password "regular2"

        HMSET api_keys:cartodb250user:1234 \
            user "cartodb250user" \
            type "master" \
            grants_sql "true" \
            database_role "${TEST_USER}" \
            database_password "${TEST_PASSWORD}"

        HMSET api_keys:cartodb250user:default_public \
            user "cartodb250user" \
            type "default" \
            grants_sql "true" \
            database_role "${PUBLIC_USER}" \
            database_password "${PUBLIC_USER_PASSWORD}"
    `;

    const oauthCommands = `
        HMSET rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR \
            consumer_key fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2 \
            consumer_secret IBLCvPEefxbIiGZhGlakYV4eM8AbVSwsHxwEYpzx \
            access_token_token l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR \
            access_token_secret 22zBIek567fMDEebzfnSdGe8peMFVFqAreOENaDK \
            user_id ${TEST_USER_ID} \
            time sometime
    `;

    await exec(`echo "${commands}" | redis-cli -p ${REDIS_PORT} -n 5`);
    await exec(`echo "${oauthCommands}" | redis-cli -p ${REDIS_PORT} -n 3`);
}

async function main (args) {
    let code = 0;

    try {
        switch (args[0]) {
        case 'setup':
            await startRedis();
            await populateRedis();
            await dropDatabase();
            await createDatabase();
            await createDatabaseExtension();
            await populateDatabase();
            break;
        case 'teardown':
            await stopRedis();
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
