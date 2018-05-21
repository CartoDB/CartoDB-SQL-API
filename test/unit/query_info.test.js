const assert = require('assert');
const queryInfo = require('../../app/utils/query_info');

describe('query info', function () {
    describe('copy format', function() {
        describe('csv', function() {
            const csvValidQueries = [
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)",
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT  CSV, DELIMITER ',', HEADER true)",
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV , DELIMITER ',', HEADER true)",
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV)",
            ];

            csvValidQueries.forEach(query => {
                it(query, function() {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.equal(result, 'CSV');
                });
            });
        });

        describe('text', function() {
            const csvValidQueries = [
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT TEXT)",
                "COPY copy_endpoints_test (id, name) FROM STDIN",
            ];

            csvValidQueries.forEach(query => {
                it(query, function() {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.equal(result, 'TEXT');
                });
            });
        });

        describe('text', function() {
            const csvValidQueries = [
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT BINARY)",
            ];

            csvValidQueries.forEach(query => {
                it(query, function() {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.equal(result, 'BINARY');
                });
            });
        });
    });
});
