'use strict';

var JobSimple = require('./job_simple');
var JobMultiple = require('./job_multiple');
var JobFallback = require('./job_fallback');

module.exports = [ JobSimple, JobMultiple, JobFallback ];
