#!/bin/sh
#!/bin/sh

# this script prepare database and redis instance to run acceptance test
#
# NOTE: assumes existance of a "template_postgis" loaded with
#       compatible version of postgis (legacy.sql included)

# This is where postgresql connection parameters are read from
TESTENV=../config/environments/test.js


# Extract postgres configuration
#PGUSER=`grep \.db_user ${TESTENV} | sed "s/.*= *'\([^']*\)'.*/\1/"`
#echo "PGUSER: [$PGUSER]"
PGHOST=`grep \.db_host ${TESTENV} | sed "s/.*= *'\([^']*\)'.*/\1/"`
echo "PGHOST: [$PGHOST]"
PGPORT=`grep \.db_port ${TESTENV} | sed "s/.*=[\t ]*'\([^']*\)'.*/\1/"`
echo "PGPORT: [$PGPORT]"
public_user=`grep \.db_pubuser ${TESTENV} | sed "s/.*= *'\([^']*\)'.*/\1/"`
[ -z "${public_user}" ] && public_user=publicuser
echo "PUBLICUSER: [${public_user}]"


TESTUSERID=1
TEST_DB="cartodb_test_user_1_db" # TODO: read from config ?
REDIS_PORT=6333 # TODO: read from environment file

export PGHOST PGPORT

die() {
        msg=$1
        echo "${msg}" >&2
        exit 1
}

echo "preparing postgres..."
dropdb ${TEST_DB} # 2> /dev/null # error expected if doesn't exist, but not otherwise
createdb -Ttemplate_postgis -EUTF8 ${TEST_DB} || die "Could not create test database"
cat test.sql | sed "s/:PUBLICUSER/${public_user}/" | psql ${TEST_DB} 
psql -f support/CDB_QueryStatements.sql ${TEST_DB} 
psql -f support/CDB_QueryTables.sql ${TEST_DB} 

echo "preparing redis..."
echo "HSET rails:users:vizzuality id 1" | redis-cli -p ${REDIS_PORT} -n 5
echo "HSET rails:users:vizzuality database_name ${TEST_DB}" | redis-cli -p ${REDIS_PORT} -n 5
echo "HSET rails:users:vizzuality" "map_key" "1234" | redis-cli -p ${REDIS_PORT} -n 5
echo "SADD rails:users:vizzuality:map_key 1235" | redis-cli -p ${REDIS_PORT} -n 5

# A user configured as with cartodb-2.5.0+
echo "HSET rails:users:cartodb250user id ${TESTUSERID}" | redis-cli -p ${REDIS_PORT} -n 5
echo 'HSET rails:users:cartodb250user database_name "'${TEST_DB}'"' | redis-cli -p ${REDIS_PORT} -n 5
echo 'HSET rails:users:cartodb250user database_host "localhost"' | redis-cli -p ${REDIS_PORT} -n 5
#echo 'HSET rails:users:cartodb250user database_password "'${TESTPASS}'"' | redis-cli -p ${REDIS_PORT} -n 5
echo "HSET rails:users:cartodb250user map_key 1235" | redis-cli -p ${REDIS_PORT} -n 5

echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR consumer_key fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2" | redis-cli -p ${REDIS_PORT} -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR consumer_secret IBLCvPEefxbIiGZhGlakYV4eM8AbVSwsHxwEYpzx" | redis-cli -p ${REDIS_PORT} -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR access_token_token l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR" | redis-cli -p ${REDIS_PORT} -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR access_token_secret 22zBIek567fMDEebzfnSdGe8peMFVFqAreOENaDK" | redis-cli -p ${REDIS_PORT} -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR user_id 1" | redis-cli -p ${REDIS_PORT} -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR time sometime" | redis-cli -p ${REDIS_PORT} -n 3



echo "ok, you can run test now"


