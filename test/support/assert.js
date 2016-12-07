var assert = module.exports = exports = require('assert');
var request = require('request');

assert.response = function(server, req, res, callback) {
    if (!callback) {
        callback = res;
        res = {};
    }

    var port = 5555,
        host = '127.0.0.1';

    var listeningAttempts = 0;
    var listener;
    function listen() {
        if (listeningAttempts > 25) {
            return callback(new Error('Tried too many ports'));
        }
        listener = server.listen(port, host);
        listener.on('error', function() {
            port++;
            listeningAttempts++;
            listen();
        });
        listener.on('listening', onServerListening);
    }

    listen();

    // jshint maxcomplexity:10
    function onServerListening() {
        var status = res.status || res.statusCode;
        var requestParams = {
            url: 'http://' + host + ':' + port + req.url,
            method: req.method || 'GET',
            headers: req.headers || {},
            timeout: req.timeout || 0,
            encoding: req.encoding || 'utf8'
        };

        if (req.body || req.data) {
            requestParams.body = req.body || req.data;
        }

        request(requestParams, function assert$response$requestHandler(error, response, body) {
            listener.close(function() {
                if (error) {
                    return callback(error);
                }

                response = response || {};
                response.body = response.body || body;

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
                    assert.equal(response.statusCode, status,
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
                        var name = keys[i],
                            actual = response.headers[name.toLowerCase()],
                            expected = res.headers[name],
                            headerEql = expected instanceof RegExp ? expected.test(actual) : expected === actual;
                        assert.ok(headerEql,
                            colorize('Invalid response header [bold]{' + name + '}.\n' +
                                '     Expected: [green]{' + expected + '}\n' +
                                '     Got: [red]{' + actual + '}')
                        );
                    }
                }

                // Callback
                callback(null, response);
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
function colorize(str) {
    var colors = { bold: 1, red: 31, green: 32, yellow: 33 };
    return str.replace(/\[(\w+)\]\{([^]*?)\}/g, function(_, color, str) {
        return '\x1B[' + colors[color] + 'm' + str + '\x1B[0m';
    });
}
