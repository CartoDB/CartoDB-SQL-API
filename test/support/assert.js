'use strict';

var assert = module.exports = exports = require('assert');
var request = require('request');
var debug = require('debug')('assert-response');

assert.response = function (server, req, res, callback) {
    if (!callback) {
        callback = res;
        res = {};
    }

    var port = 5555;
    var host = '127.0.0.1';

    var listeningAttempts = 0;
    var listener;
    function listen () {
        if (listeningAttempts > 25) {
            var message = 'Tried too many ports';
            debug(message);
            return callback(new Error(message));
        }
        listener = server.listen(port, host);
        listener.on('error', function () {
            port++;
            listeningAttempts++;
            listen();
        });
        listener.on('listening', onServerListening);
    }

    listen();

    debug('Request definition', req);

    function onServerListening () {
        debug('Server listening on port = %d', port);
        var status = res.status || res.statusCode;
        var requestParams = {
            url: 'http://' + host + ':' + port + req.url,
            method: req.method || 'GET',
            headers: req.headers || {},
            timeout: req.timeout || 5000,
            encoding: req.encoding || 'utf8'
        };

        if (req.body || req.data) {
            requestParams.body = req.body || req.data;
        }

        if (req.formData) {
            requestParams.formData = req.formData;
        }

        debug('Request params', requestParams);
        request(requestParams, function assert$response$requestHandler (error, response, body) {
            debug('Request response', error);
            listener.close(function () {
                debug('Server closed');
                if (error) {
                    return callback(error);
                }

                response = response || {};
                response.body = response.body || body;
                debug('Response status', response.statusCode);

                // Assert response body
                if (res.body) {
                    var eql = res.body instanceof RegExp ? res.body.test(response.body) : res.body === response.body;
                    assert.ok(
                        eql,
                        colorize('[red]{Invalid response body.}\n' +
                            '     Expected: [green]{' + res.body + '}\n' +
                            '     Got: [red]{' + response.body + '}')
                    );
                }

                // Assert response status
                if (typeof status === 'number') {
                    assert.strictEqual(response.statusCode, status,
                        colorize('[red]{Invalid response status code.}\n' +
                            '     Expected: [green]{' + status + '}\n' +
                            '     Got: [red]{' + response.statusCode + '}\n' +
                            '     Body: ' + response.body)
                    );
                }

                // Assert response headers
                if (res.headers) {
                    var keys = Object.keys(res.headers);
                    for (var i = 0, len = keys.length; i < len; ++i) {
                        var name = keys[i];
                        var actual = response.headers[name.toLowerCase()];
                        var expected = res.headers[name];
                        var headerEql = expected instanceof RegExp ? expected.test(actual) : expected === actual;
                        assert.ok(headerEql,
                            colorize('Invalid response header [bold]{' + name + '}.\n' +
                                '     Expected: [green]{' + expected + '}\n' +
                                '     Got: [red]{' + actual + '}')
                        );
                    }
                }

                // Callback
                return callback(null, response);
            });
        });
    }
};

/**
 * Colorize the given string using ansi-escape sequences.
 * Disabled when --boring is set.
 *
 * @param {String} str
 * @return {String}
 */
function colorize (str) {
    var colors = { bold: 1, red: 31, green: 32, yellow: 33 };
    return str.replace(/\[(\w+)\]\{([^]*?)\}/g, function (_, color, str) {
        return '\x1B[' + colors[color] + 'm' + str + '\x1B[0m';
    });
}
