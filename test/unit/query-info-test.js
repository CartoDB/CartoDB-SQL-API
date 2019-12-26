'use strict';

const assert = require('assert');
const queryInfo = require('../../lib/utils/query-info');

describe('query info', function () {
    describe('copy format', function () {
        describe('csv', function () {
            const validQueries = [
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)",
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT  CSV, DELIMITER ',', HEADER true)",
                "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV , DELIMITER ',', HEADER true)",
                'COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV)',
                'COPY copy_endpoints_test FROM STDIN WITH(FORMAT csv,HEADER true)'
            ];

            validQueries.forEach(query => {
                it(query, function () {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.strictEqual(result, 'CSV');
                });
            });
        });

        describe('text', function () {
            const validQueries = [
                'COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT TEXT)',
                'COPY copy_endpoints_test (id, name) FROM STDIN'
            ];

            validQueries.forEach(query => {
                it(query, function () {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.strictEqual(result, 'TEXT');
                });
            });
        });

        describe('binary', function () {
            const validQueries = [
                'COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT BINARY)'
            ];

            validQueries.forEach(query => {
                it(query, function () {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.strictEqual(result, 'BINARY');
                });
            });
        });

        describe('should fail', function () {
            const validQueries = [
                'COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT ERROR)',
                'SELECT * from copy_endpoints_test'
            ];

            validQueries.forEach(query => {
                it(query, function () {
                    const result = queryInfo.getFormatFromCopyQuery(query);
                    assert.strictEqual(result, false);
                });
            });
        });
    });
});
