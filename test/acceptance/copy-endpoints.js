require('../helper');

const fs = require('fs');
const server = require('../../app/server')();
const assert = require('../support/assert');

describe.only('copy-endpoints', function() {
    it('should works with copyfrom endpoint', function(done){
        assert.response(server, {
            url: "/api/v1/sql/copyfrom",
            formData: {
                sql: "COPY copy_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)",
                file: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),
            },
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'POST'
        },{}, function(err, res) {
            assert.ifError(err);
            const response = JSON.parse(res.body);
            assert.equal(!!response.time, true);
            assert.strictEqual(response.total_rows, 6);
            done();
        });
    });
});
