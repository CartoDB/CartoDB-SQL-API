#!/bin/bash

/etc/init.d/postgresql start

source /src/nodejs-install.sh

# Configure
./configure

# Install cartodb-postgresql extension
git clone https://github.com/CartoDB/cartodb-postgresql.git
cd cartodb-postgresql && make && make install && cd ..

echo "Node.js version: "
node -v

echo "npm version:"
npm -v

# install dependencies
npm ci
npm ls

npm test
