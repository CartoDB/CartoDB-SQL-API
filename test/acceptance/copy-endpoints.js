require('../helper');

const fs = require('fs');
const querystring = require('querystring');
const server = require('../../app/server')();
const assert = require('../support/assert');

describe('copy-endpoints', function() {
    it('should work with copyfrom endpoint', function(done){
        assert.response(server, {
            url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                sql: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
            }),
            data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),
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

    it('should fail with copyfrom endpoint and unexisting table', function(done){
        assert.response(server, {
            url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                sql: "COPY unexisting_table (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
            }),
            data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'POST'
        },{}, function(err, res) {
            assert.ifError(err);
            assert.deepEqual(
                JSON.parse(res.body), 
                {
                    error:['relation \"unexisting_table\" does not exist']
                }
            );
            done();
        });
    });

    it('should fail with copyfrom endpoint and without csv', function(done){
        assert.response(server, {
            url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                sql: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
            }),
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'POST'
        },{}, function(err, res) {
            assert.ifError(err);
            assert.deepEqual(
                JSON.parse(res.body), 
                {
                    error:['No rows copied']
                }
            );
            done();
        });
    });

    it('should fail with copyfrom endpoint and without sql', function(done){
        assert.response(server, {
            url: "/api/v1/sql/copyfrom",
            data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),            
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'POST'
        },{}, function(err, res) {
            assert.ifError(err);
            assert.deepEqual(
                JSON.parse(res.body), 
                {
                    error:["Parameter 'sql' is missing, must be in URL or first field in POST"]
                }
            );
            done();
        });
    });

    it('should work with copyto endpoint', function(done){
        assert.response(server, {
            url: "/api/v1/sql/copyto?" + querystring.stringify({
                sql: 'COPY copy_endpoints_test TO STDOUT',
                filename: '/tmp/output.dmp'
            }),
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        },{}, function(err, res) {
            assert.ifError(err);
            assert.strictEqual(
                res.body, 
                '11\tPaul\t10\n12\tPeter\t10\n13\tMatthew\t10\n14\t\\N\t10\n15\tJames\t10\n16\tJohn\t10\n'
            );
            done();
        });
    });

    it('should work with copyfrom and gzip', function(done){
        assert.response(server, {
            url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                sql: "COPY copy_endpoints_test2 (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
            }),
            data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv.gz'),
            headers: {
                host: 'vizzuality.cartodb.com', 
                'content-encoding': 'gzip'
            },
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
