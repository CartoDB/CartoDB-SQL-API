#!/bin/bash

usage() {
    /etc/init.d/postgresql stop
    echo "Usage: $0 [nodejs10|nodejs6]"
    exit 1
}

echo "$0 $1"

# start PostgreSQL
/etc/init.d/postgresql start

# Configure
./configure

echo "Node.js version:"
node -v

# install dependencies
NODEJS_VERSION=${1-nodejs10}

if [ "$NODEJS_VERSION" = "nodejs10" ];
then
    echo "npm version on install:"
    npm -v
    mv npm-shrinkwrap.json npm-shrinkwrap.json.backup
    npm ci
    npm ls
    mv npm-shrinkwrap.json.backup npm-shrinkwrap.json
elif [ "$NODEJS_VERSION" = "nodejs6" ];
then
    echo "npm version on install:"
    npm -v
    mv package-lock.json package-lock.json.backup
    npm i
    npm ls
    mv package-lock.json.backup package-lock.json
else
    usage
fi

# run tests
echo "npm version on tests:"
npm -v

npm test
