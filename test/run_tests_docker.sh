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
npm ci
npm ls

npm test
