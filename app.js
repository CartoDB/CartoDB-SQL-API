#! /Users/fernando/local/node/bin/node

var app    = require('express').createServer()
  , pg     = require('pg').native
  , Step   = require('./step')
  , _      = require('underscore')
  , redis  = require("redis")
  , redisClient = redis.createClient();

redisClient.select(3);
_.mixin(require('underscore.string'));

function authenticate(req){
  var oauth_token;
  // Parameter oauth_token with the OAuth token
  if (!_.isUndefined(req.query.oauth_token)){
    oauth_token = _.trim(req.query.oauth_token);
  } else if (!_.isUndefined(req.headers.authorization)) { 
    // OAuth token is in the header Authorization
    oauth_token = req.headers.authorization.match(/oauth_token=\"([^\"]+)\"/)[1]
  }
  if (!_.isUndefined(oauth_token)) {
    return oauth_token;
  }
}

app.get('/v1/', function(req, res){
  if (!_.isUndefined(req.query.sql)){
    var sql = _.trim(req.query.sql);
    var conString;
    Step(
      function getUser(err) {
        var oauth_token = authenticate(req);
        console.log("oauth_token: " + oauth_token);
        if (!_.isUndefined(oauth_token)) {
          redisClient.hget("rails:oauth_tokens:" + oauth_token, "user_id", this);
        } else {
          connectDb(undefined,undefined);
        }
        console.log("next step!");
      },
      function connectDb(error, reply){
        if(!_.isUndefined(reply)) {
          var user_id = reply.toString();
          // TODO: 
          //   - database_username: depending on the environment is different:
          //     - development: dev_cartodb_user_33  
          //     - test: test_cartodb_user_33
          //     - production: cartodb_user_33
          //   - database_name: depending on the environment is different:
          //     - development: cartodb_dev_user_33_db
          //     - test: cartodb_test_user_33_db
          //     - production: cartodb_user_33_db
          var database_username = "cartodb_user_" + user_id;
          var database_name = "cartodb_dev_user_" + user_id + "_db"
          conString = "tcp://" + database_username + "@localhost/" + database_name;
        } else {
          // TODO:
          //   - if the user doesn't identify who is how do we now to which database to connect?
          //     I think it's impossible to know unless each request goes to a different subdomain
          //     depending on the user
          conString = "tcp://publicuser@localhost/cartodb_dev_user_2_db";
        }
        pg.connect(conString, this);
      },
      function queryDb(err, client){
        if (err) throw err;
        client.query(sql, this);
      },
      function setResultToBrowser(err, result){
        if (err) 
          res.send({error:[err.message]}, 400);
        else
          res.send(result.rows);
      }
    );
  } else {
    res.send({error:["You must indicate a sql query"]}, 400);
  }
});

module.exports = app;
