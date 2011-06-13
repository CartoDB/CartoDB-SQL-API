var _ = require('underscore');

global.settings  = require(__dirname + '/../config/settings');
var env          = require(__dirname + '/../config/environments/test');
_.extend(global.settings, env);
