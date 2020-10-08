'use strict';

const formats = require('../../models/formats');

module.exports = function formatter () {
    return function formatterMiddleware (req, res, next) {
        const { params: { format },  userDbParams: { streamingmode } } = res.locals;

        /* parses streamingmode to boolean. This is:
          streamingmode = undefined --> true
          streamingmode = null      --> true
          streamingmode = 'true'    --> true
          streamingmode = true      --> true
          streamingmode = 'false'   --> false
          streamingmode = false     --> false
        */
        const streamingmodeBool = streamingmode !== 'false' && streamingmode !== false;

        const FormatClass = formats[format];
        req.formatter = new FormatClass(streamingmodeBool);

        next();
    };
};
