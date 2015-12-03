'use strict';

var setCrossDomain = require('../utils/cross_domain');

function GenericController() {
}

GenericController.prototype.register = function (app) {
    app.get('*', this.handleRequest.bind(this));
};

GenericController.prototype.handleRequest = function(req, res) {
    setCrossDomain(res);
    res.end();
};

module.exports = GenericController;
