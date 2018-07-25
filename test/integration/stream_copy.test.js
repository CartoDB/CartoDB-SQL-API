require('../helper');
const assert = require('assert');

const StreamCopy = require('../../app/services/stream_copy');

describe('stream copy', function() {
    it('uses batch api port', function(done) {
        const userDbParams = {
            dbname: 'cartodb_test_user_1_db',
            dbuser: 'test_cartodb_user_1',
            pass: 'test_cartodb_user_1_pass',
            port: 'invalid_port'
        };
        const sql = 'COPY dummy_table FROM STDIN';
        const streamCopy = new StreamCopy(sql, userDbParams);
        assert.equal(streamCopy.pg.dbopts.port, global.settings.db_batch_port);
        done();
    });
});
