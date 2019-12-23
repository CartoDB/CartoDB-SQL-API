'use strict';

var util = require('util');
var JobStateMachine = require('../job-state-machine');

function QueryBase (index) {
    JobStateMachine.call(this);

    this.index = index;
}
util.inherits(QueryBase, JobStateMachine);

module.exports = QueryBase;

// should be implemented
QueryBase.prototype.setStatus = function () {
    throw new Error('Unimplemented method');
};

// should be implemented
QueryBase.prototype.getNextQuery = function () {
    throw new Error('Unimplemented method');
};

QueryBase.prototype.hasNextQuery = function (job) {
    return !!this.getNextQuery(job);
};

QueryBase.prototype.getStatus = function () {
    throw new Error('Unimplemented method');
};
