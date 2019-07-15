#!/bin/sh

# this script prepare database and redis instance to run acceptance test
#
# NOTE: assumes existance of a "template_postgis" loaded with
#       compatible version of postgis (legacy.sql included)

PREPARE_REDIS=yes
PREPARE_PGSQL=yes

while [ -n "$1" ]; do
  if test "$1" = "--skip-pg"; then
    PREPARE_PGSQL=no
    shift; continue
  elif test "$1" = "--skip-redis"; then
    PREPARE_REDIS=no
    shift; continue
  fi
done

die() {
        msg=$1
        echo "${msg}" >&2
        exit 1
}

# This is where postgresql connection parameters are read from
TESTENV=../config/environments/test.js

# Extract postgres configuration
PGHOST=`node -e "console.log(require('${TESTENV}').db_host || '')"`
echo "PGHOST: [$PGHOST]"
PGPORT=`node -e "console.log(require('${TESTENV}').db_port || '')"`
echo "PGPORT: [$PGPORT]"

PUBLICUSER=`node -e "console.log(require('${TESTENV}').db_pubuser || 'xxx')"`
PUBLICPASS=`node -e "console.log(require('${TESTENV}').db_pubuser_pass || 'xxx')"`
echo "PUBLICUSER: [${PUBLICUSER}]"
echo "PUBLICPASS: [${PUBLICPASS}]"

TESTUSERID=1

TESTUSER=`node -e "console.log(require('${TESTENV}').db_user || '')"`
if test -z "$TESTUSER"; then
  echo "Missing db_user from ${TESTENV}" >&2
  exit 1
fi
TESTUSER=`echo ${TESTUSER} | sed "s/<%= user_id %>/${TESTUSERID}/"`
echo "TESTUSER: [${TESTUSER}]"

TESTPASS=`node -e "console.log(require('${TESTENV}').db_user_pass || '')"`
TESTPASS=`echo ${TESTPASS} | sed "s/<%= user_id %>/${TESTUSERID}/"`
echo "TESTPASS: [${TESTPASS}]"

TESTUSER_FOREIGN=`echo ${TESTUSER}_foreign`
echo "TESTUSER_FOREIGN: [${TESTUSER_FOREIGN}]"
TESTPASS_FOREIGN=`echo ${TESTPASS}_foreign`
echo "TESTPASS_FOREIGN: [${TESTPASS_FOREIGN}]"

TEST_DB=`node -e "console.log(require('${TESTENV}').db_base_name || '')"`
if test -z "$TEST_DB"; then
  echo "Missing db_base_name from ${TESTENV}" >&2
  exit 1
fi
TEST_DB=`echo ${TEST_DB} | sed "s/<%= user_id %>/${TESTUSERID}/"`
TEST_DB_FOREIGN=`echo ${TEST_DB}_foreign`

export PGHOST PGPORT

if test x"$PREPARE_PGSQL" = xyes; then

  echo "preparing postgres..."
  echo "PostgreSQL server version: `psql -A -t -c 'select version()'`"
  echo "PAUSE; RESUME;" | psql pgbouncer 2>/dev/null # make sure there are no connections pgbouncer -> test_db
  dropdb --if-exists ${TEST_DB} || die "Could not drop test database ${TEST_DB}"
  createdb -Ttemplate_postgis -EUTF8 ${TEST_DB} || die "Could not create test database ${TEST_DB}"
  psql -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' ${TEST_DB}
  psql -c "CREATE EXTENSION IF NOT EXISTS cartodb CASCADE;" ${TEST_DB}
  psql -c "CREATE EXTENSION IF NOT EXISTS postgres_fdw;" ${TEST_DB}

  LOCAL_SQL_SCRIPTS='test populated_places_simple_reduced py_sleep quota_mock'
  for i in ${LOCAL_SQL_SCRIPTS}
  do
    cat support/sql/${i}.sql |
      sed -e 's/cartodb\./public./g' -e "s/''cartodb''/''public''/g" |
      sed "s/:TESTUSER_FOREIGN/${TESTUSER_FOREIGN}/" |
      sed "s/:TESTPASS_FOREIGN/${TESTPASS_FOREIGN}/" |
      sed "s/:TEST_DB_FOREIGN/${TEST_DB_FOREIGN}/" |
      sed "s/:PUBLICUSER/${PUBLICUSER}/" |
      sed "s/:PUBLICPASS/${PUBLICPASS}/" |
      sed "s/:TESTUSER/${TESTUSER}/" |
      sed "s/:TESTPASS/${TESTPASS}/" |
      psql -q -v ON_ERROR_STOP=1 ${TEST_DB} > /dev/null || exit 1
  done

  echo "preparing foreign postgres database without cartodb extension..."
  dropdb --if-exists ${TEST_DB_FOREIGN} || die "Could not drop test database ${TEST_DB_FOREIGN}"
  createdb -Ttemplate_postgis -EUTF8 ${TEST_DB_FOREIGN} || die "Could not create test database ${TEST_DB_FOREIGN}"
  psql -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' ${TEST_DB_FOREIGN}

  FOREIGN_SQL_SCRIPTS='test_foreign'
  for i in ${FOREIGN_SQL_SCRIPTS}
  do
    cat support/sql/${i}.sql |
      sed -e 's/cartodb\./public./g' -e "s/''cartodb''/''public''/g" |
      sed "s/:TESTUSER/${TESTUSER_FOREIGN}/" |
      sed "s/:TESTPASS/${TESTPASS_FOREIGN}/" |
      psql -q -v ON_ERROR_STOP=1 ${TEST_DB_FOREIGN} > /dev/null || exit 1
  done
fi

if test x"$PREPARE_REDIS" = xyes; then

  REDIS_HOST=`node -e "console.log(require('${TESTENV}').redis_host || '127.0.0.1')"`
  REDIS_PORT=`node -e "console.log(require('${TESTENV}').redis_port || '6336')"`

  echo "preparing redis..."

  # delete previous publicuser
  cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
HDEL rails:users:vizzuality database_host
HDEL rails:users:vizzuality database_publicuser
EOF

  cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
HMSET rails:users:vizzuality \
 id 1 \
 database_name ${TEST_DB} \
 database_host ${PGHOST} \
 map_key 1234
SADD rails:users:vizzuality:map_key 1235
EOF

  # A user configured as with cartodb-2.5.0+
  cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
HMSET rails:users:cartodb250user \
 id ${TESTUSERID} \
 database_name ${TEST_DB} \
 database_host ${PGHOST} \
 database_password ${TESTPASS} \
 map_key 1234
SADD rails:users:cartodb250user:map_key 1234
EOF

  cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 3
HMSET rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR \
 consumer_key fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2 \
 consumer_secret IBLCvPEefxbIiGZhGlakYV4eM8AbVSwsHxwEYpzx \
 access_token_token l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR \
 access_token_secret 22zBIek567fMDEebzfnSdGe8peMFVFqAreOENaDK \
 user_id 1 \
 time sometime
EOF

  cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
HMSET rails:users:cartofante \
 id 2 \
 database_name ${TEST_DB} \
 database_host ${PGHOST} \
 database_password test_cartodb_user_2_pass \
 map_key 4321
SADD rails:users:fallback_1:map_key 4321
EOF

# delete previous jobs
cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
EVAL "return redis.call('del', unpack(redis.call('keys', ARGV[1])))" 0 batch:jobs:*
EOF

# delete job queue
cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
DEL batch:queues:localhost
EOF

# delete user index
cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
DEL batch:users:vizzuality
EOF

# User: vizzuality

# API Key Default public
cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
HMSET api_keys:vizzuality:default_public \
  user "vizzuality" \
  type "default" \
  grants_sql "true" \
  database_role "testpublicuser" \
  database_password "public"
EOF

# API Key Master
cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
HMSET api_keys:vizzuality:1234 \
  user "vizzuality" \
  type "master" \
  grants_sql "true" \
  database_role "${TESTUSER}" \
  database_password "${TESTPASS}"
EOF

# API Key Regular1
cat <<EOF | redis-cli -p ${REDIS_PORT} -n 5
  HMSET api_keys:vizzuality:regular1 \
    user "vizzuality" \
    type "regular" \
    grants_sql "true" \
    database_role "regular_1" \
    database_password "regular1"
EOF

# API Key Regular1
cat <<EOF | redis-cli -p ${REDIS_PORT} -n 5
  HMSET api_keys:vizzuality:regular2 \
    user "vizzuality" \
    type "regular" \
    grants_sql "true" \
    database_role "regular_2" \
    database_password "regular2"
EOF

# User: cartodb250user

# API Key Default public
cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
HMSET api_keys:cartodb250user:default_public \
  user "cartodb250user" \
  type "default" \
  grants_sql "true" \
  database_role "testpublicuser" \
  database_password "public"
EOF

# API Key Master
cat <<EOF | redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -n 5
HMSET api_keys:cartodb250user:1234 \
  user "cartodb250user" \
  type "master" \
  grants_sql "true" \
  database_role "${TESTUSER}" \
  database_password "${TESTPASS}"
EOF

fi

echo "ok, you can run test now"
