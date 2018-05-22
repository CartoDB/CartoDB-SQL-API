const assert = require('assert');
const queryInfo = require('../../app/utils/query_info');

describe('query info', function () {
    describe('copy format', function() {
        describe('csv', function() {
            const validQueries = [
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)",
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT  CSV, DELIMITER ',', HEADER true)",
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV , DELIMITER ',', HEADER true)",
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV)",
            ];

            validQueries.forEach(query => {
                it(query, function() {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.equal(result, 'CSV');
                });
            });
        });

        describe('text', function() {
            const validQueries = [
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT TEXT)",
                "COPY copy_endpoints_test (id, name) FROM STDIN",
            ];

            validQueries.forEach(query => {
                it(query, function() {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.equal(result, 'TEXT');
                });
            });
        });

        describe('binary', function() {
            const validQueries = [
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT BINARY)",
            ];

            validQueries.forEach(query => {
                it(query, function() {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.equal(result, 'BINARY');
                });
            });
        });
    });
});
