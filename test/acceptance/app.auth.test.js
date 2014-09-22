require('../helper');
require('../support/assert');

var app    = require(global.settings.app_root + '/app/controllers/app')()
    , assert = require('assert')
    , tests  = module.exports = {}
    , querystring = require('querystring');

suite('app.auth', function() {

    var scenarios = [
        {
            desc: 'valid api key should allow insert in protected tables',
            url: "/api/v1/sql?api_key=1234&q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('app_auth_test1')",
            statusCode: 200
        }
        ,{
            desc: 'valid api key should allow delete in protected tables',
            url: "/api/v1/sql?api_key=1234&q=DELETE%20FROM%20private_table%20WHERE%20name%3d'app_auth_test1'",
            statusCode: 200
        }
        ,{
            desc: 'invalid api key should NOT allow insert in protected tables',
            url: "/api/v1/sql?api_key=RAMBO&q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('RAMBO')",
            statusCode: 401
        }
        ,{
            desc: 'invalid api key (old redis location) should NOT allow insert in protected tables',
            url: "/api/v1/sql?api_key=1235&q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('RAMBO')",
            statusCode: 401
        }
        ,{
            desc: 'no api key should NOT allow insert in protected tables',
            url: "/api/v1/sql?q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('RAMBO')",
            statusCode: 401
        }
        ,{
            desc: 'no api key should NOT allow insert in public tables',
            url: "/api/v1/sql?q=INSERT%20INTO%20untitle_table_4%20(name)%20VALUES%20('RAMBO')",
            statusCode: 401
        }
    ];

    scenarios.forEach(function(scenario) {
        test(scenario.desc, function(done) {
            assert.response(app, {
                    // view prepare_db.sh to find public table name and structure
                    url: scenario.url,
                    headers: {
                        host: 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                },
                {},
                function(res) {
                    assert.equal(res.statusCode, scenario.statusCode, res.statusCode + ': ' + res.body);
                    done();
                }
            );
        });
    });

});
