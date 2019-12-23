'use strict';

module.exports = function forever (fn, done) {
    function next (err) {
        if (err) {
            return done(err);
        }
        fn(next);
    }
    next();
};
