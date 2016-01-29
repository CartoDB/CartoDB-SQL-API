'use strict';

function GenericController() {
}

GenericController.prototype.route = function (app) {
    app.options('*', this.handleRequest.bind(this));
};

GenericController.prototype.handleRequest = function(req, res) {
    res.end();
};

module.exports = GenericController;
