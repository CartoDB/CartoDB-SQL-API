// #! /Users/fernando/local/node/bin/node
// 
// var cluster = require('cluster');
// 
// cluster('./app')
//   .use(cluster.logger('logs'))
//   .set('workers', 2)
//   .use(cluster.stats())
//   .use(cluster.pidfiles('pids'))
//   .use(cluster.cli())
//   .use(cluster.repl(8888))
//   .use(cluster.debug())
//   .listen(3000);
