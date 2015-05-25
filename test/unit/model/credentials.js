require('../../helper');
var assert = require('assert');
var _ = require('underscore');

var CredentialsModel = require('../../../app/models/credentials');

// jshint nonew:false
describe('credentials', function() {
    var host = 'localhost';
    var validCredentials = {
        host: host,
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        dbname: 'postgres'
    };

    it('should support happy case', function() {
        assert.doesNotThrow(
            function() {
                new CredentialsModel(validCredentials);
            },
            'unexpected error while creating credentials object'
        );
    });

    it('should fail for undefined credentials param', function() {
        assert.throws(
            function() {
                new CredentialsModel();
            },
            /credentials param must be an object/
        );
    });

    it('should fail for string port', function() {
        assert.throws(
            function() {
                new CredentialsModel(_.defaults({ port: '5432' }, validCredentials));
            },
            /Invalid or missing credential port/
        );
    });

    describe('string params', function() {
        var stringParams = ['host', 'user', 'password', 'dbname'];

        stringParams.forEach(function(paramName) {
            it('should fail for non string params ' + paramName, function() {
                var credentials = {};
                credentials[paramName] = 1234;
                credentials = _.defaults(credentials, validCredentials);
                assert.throws(
                    function() {
                        new CredentialsModel(credentials);
                    },
                    new RegExp('Invalid or missing credential ' + paramName)
                );
            });
        });
    });

    describe('missing params', function() {
        var allParams = ['host', 'port', 'user', 'password', 'dbname'];

        allParams.forEach(function(paramName) {
            it('should fail when param ' + paramName + ' is missing', function() {
                assert.throws(
                    function() {
                        new CredentialsModel(_.omit(validCredentials, paramName));
                    },
                    new RegExp('Invalid or missing credential ' + paramName)
                );
            });
        });
    });

});
// jshint nonew:true

