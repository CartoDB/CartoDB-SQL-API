# start PostgreSQL
/etc/init.d/postgresql start

# Configure
./configure

# install dependencies
npm ci

# run tests
npm test
