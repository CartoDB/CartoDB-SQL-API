#!/bin/bash

/etc/init.d/postgresql start

source /src/nodejs-install.sh

# Configure
./configure

echo "Node.js version: "
node -v

echo "npm version:"
npm -v

# install dependencies
if [ "$NODEJS_VERSION" = "6.9.2" ];
then
    mv package-lock.json package-lock.json.backup
    npm i
    npm ls
    mv package-lock.json.backup package-lock.json
else
    mv npm-shrinkwrap.json npm-shrinkwrap.json.backup
    npm ci
    npm ls
    mv npm-shrinkwrap.json.backup npm-shrinkwrap.json
fi

npm test
