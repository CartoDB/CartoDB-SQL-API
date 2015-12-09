
var batchManagerFactory = require('../../batch/batch_manager_factory');

describe('batch manager', function() {
    it('run', function (done) {
        batchManagerFactory().run(function (err) {
            done(err);
        });
    });
});
