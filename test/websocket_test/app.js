'use strict';

// this is a test to understand accessing sql api via websockets
var express = require('express')
  , app     = express.createServer(
    express.logger({
        buffer: true,
        format: '[:date] :req[X-Real-IP] \033[90m:method\033[0m \033[36m:req[Host]:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m'
    }))
    , Step     = require('step')
    , _        = require('underscore');

app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));
app.enable('jsonp callback');

var io = require('socket.io');
io = io.listen(app);

io.configure('development', function(){
    io.set('log level', 1);
    io.set('origins', '*:*');
});

app.listen(8080);

// hacked postgres setup
//var pg = require('pg');
var pg = require('pg').native //native libpq bindings = `
var conString = "tcp://postgres@localhost/cartodb_dev_user_2_db";

var client = new pg.Client(conString);
client.connect();


io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });

  socket.on('sql_query', function(data){

      var query = client.query(data.sql);
      var id = data.id;

      query.on('row', function(row) {
          socket.emit("sql_result", {r:row, id:id, state:1})
      });

      query.on('end',function(){
          socket.emit("sql_result", {id:id, state:0});
      });

      query.on('error', function(row){
          socket.emit("sql_result", {r:row, id:id, state:-1})
      });
  });
});
