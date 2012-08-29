#!/bin/sh

# Must match redis_port in config/environments/test.js
# TODO: read from there
REDIS_PORT=6333

cleanup() {
	echo "Cleaning up"
	kill ${PID_REDIS}
}

cleanup_and_exit() {
	cleanup
	exit
}

die() {
	msg=$1
	echo "${msg}" >&2
	cleanup
	exit 1
}

trap 'cleanup_and_exit' 1 2 3 5 9 13

echo "Starting redis on port ${REDIS_PORT}"
echo "port ${REDIS_PORT}" | redis-server - > test/test.log &
PID_REDIS=$!

echo "Preparing the environment"
cd test; sh prepare_db.sh >> test.log || die "database preparation failure (see test.log)"; cd -;

PATH=node_modules/.bin/:$PATH

echo "Running tests"
mocha -u tdd \
  test/unit/redis_pool.test.js \
  test/unit/metadata.test.js \
  test/unit/oauth.test.js \
  #test/unit/psql.test.js \
  test/acceptance/app.test.js  \
  test/acceptance/app.auth.test.js 


cleanup
