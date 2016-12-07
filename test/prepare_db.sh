#!/bin/sh

# this script prepare database and redis instance to run acceptance test
#
# NOTE: assumes existance of a "template_postgis" loaded with
#       compatible version of postgis (legacy.sql included)

PREPARE_REDIS=yes
PREPARE_PGSQL=yes
OFFLINE=no

while [ -n "$1" ]; do
  if test "$1" = "--skip-pg"; then
    PREPARE_PGSQL=no
    shift; continue
  elif test "$1" = "--skip-redis"; then
    PREPARE_REDIS=no
    shift; continue
  elif test "$1" = "--offline"; then
    OFFLINE=yes
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

TEST_DB=`node -e "console.log(require('${TESTENV}').db_base_name || '')"`
if test -z "$TEST_DB"; then
  echo "Missing db_base_name from ${TESTENV}" >&2
  exit 1
fi
TEST_DB=`echo ${TEST_DB} | sed "s/<%= user_id %>/${TESTUSERID}/"`

export PGHOST PGPORT

if test x"$PREPARE_PGSQL" = xyes; then

  echo "preparing postgres..."
  echo "PostgreSQL server version: `psql -A -t -c 'select version()'`"
  dropdb ${TEST_DB} # 2> /dev/null # error expected if doesn't exist, but not otherwise
  createdb -Ttemplate_postgis -EUTF8 ${TEST_DB} || die "Could not create test database"
  psql -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' ${TEST_DB}
  psql -c "CREATE EXTENSION IF NOT EXISTS plpythonu;" ${TEST_DB}

  LOCAL_SQL_SCRIPTS='test populated_places_simple_reduced'
  REMOTE_SQL_SCRIPTS='CDB_QueryStatements CDB_QueryTables CDB_CartodbfyTable CDB_TableMetadata CDB_ForeignTable CDB_UserTables CDB_ColumnNames CDB_ZoomFromScale CDB_OverviewsSupport CDB_Overviews'

  if test x"$OFFLINE" = xno; then
      CURL_ARGS=""
      for i in ${REMOTE_SQL_SCRIPTS}
      do
        CURL_ARGS="${CURL_ARGS}\"https://github.com/CartoDB/cartodb-postgresql/raw/master/scripts-available/$i.sql\" -o support/sql/$i.sql "
      done
      echo "Downloading and updating: ${REMOTE_SQL_SCRIPTS}"
      echo ${CURL_ARGS} | xargs curl -L -s
  fi

  psql -c "CREATE EXTENSION IF NOT EXISTS plpythonu;" ${TEST_DB}
  ALL_SQL_SCRIPTS="${REMOTE_SQL_SCRIPTS} ${LOCAL_SQL_SCRIPTS}"
  for i in ${ALL_SQL_SCRIPTS}
  do
    cat support/sql/${i}.sql |
      sed -e 's/cartodb\./public./g' -e "s/''cartodb''/''public''/g" |
      sed "s/:PUBLICUSER/${PUBLICUSER}/" |
      sed "s/:PUBLICPASS/${PUBLICPASS}/" |
      sed "s/:TESTUSER/${TESTUSER}/" |
      sed "s/:TESTPASS/${TESTPASS}/" |
      PGOPTIONS='--client-min-messages=WARNING' psql -q -v ON_ERROR_STOP=1 ${TEST_DB} > /dev/null || exit 1
  done

fi

if test x"$PREPARE_REDIS" = xyes; then

  REDIS_PORT=`node -e "console.log(require('${TESTENV}').redis_port || '6336')"`

  echo "preparing redis..."

  # delete previous publicuser
  cat <<EOF | redis-cli -p ${REDIS_PORT} -n 5
HDEL rails:users:vizzuality database_host
HDEL rails:users:vizzuality database_publicuser
EOF

  cat <<EOF | redis-cli -p ${REDIS_PORT} -n 5
HMSET rails:users:vizzuality \
 id 1 \
 database_name ${TEST_DB} \
 database_host localhost \
 map_key 1234
SADD rails:users:vizzuality:map_key 1235
EOF

  # A user configured as with cartodb-2.5.0+
  cat <<EOF | redis-cli -p ${REDIS_PORT} -n 5
HMSET rails:users:cartodb250user \
 id ${TESTUSERID} \
 database_name ${TEST_DB} \
 database_host localhost \
 database_password ${TESTPASS} \
 map_key 1234
EOF

  cat <<EOF | redis-cli -p ${REDIS_PORT} -n 3
HMSET rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR \
 consumer_key fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2 \
 consumer_secret IBLCvPEefxbIiGZhGlakYV4eM8AbVSwsHxwEYpzx \
 access_token_token l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR \
 access_token_secret 22zBIek567fMDEebzfnSdGe8peMFVFqAreOENaDK \
 user_id 1 \
 time sometime
EOF

# delete previous jobs
cat <<EOF | redis-cli -p ${REDIS_PORT} -n 5
EVAL "return redis.call('del', unpack(redis.call('keys', ARGV[1])))" 0 batch:jobs:*
EOF

# delete job queue
cat <<EOF | redis-cli -p ${REDIS_PORT} -n 5
DEL batch:queues:localhost
EOF

# delete user index
cat <<EOF | redis-cli -p ${REDIS_PORT} -n 5
DEL batch:users:vizzuality
EOF

fi

echo "ok, you can run test now"
