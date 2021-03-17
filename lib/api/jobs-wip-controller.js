'use strict';

const bodyParser = require('./middlewares/body-parser');
const error = require('./middlewares/error');

module.exports = class JobsWipController {
    constructor ({ jobService }) {
        this.jobService = jobService;
    }

    route (apiRouter) {
        apiRouter.get('/jobs-wip', [
            bodyParser(),
            listWorkInProgressJobs(this.jobService),
            sendResponse(),
            error({ logger: null })
        ]);
    }
};

function listWorkInProgressJobs (jobService) {
    return function listWorkInProgressJobsMiddleware (req, res, next) {
        jobService.listWorkInProgressJobs((err, list) => {
            if (err) {
                return next(err);
            }

            res.body = list;

            next();
        });
    };
}

function sendResponse () {
    return function sendResponseMiddleware (req, res) {
        res.status(res.statusCode || 200).send(res.body);
    };
}
