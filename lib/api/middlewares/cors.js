'use strict';

module.exports = function cors () {
    return function (req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', '*');
        res.header('Access-Control-Expose-Headers', '*');

        if (req.method === 'OPTIONS') {
            return res.send();
        }

        next();
    };
};
