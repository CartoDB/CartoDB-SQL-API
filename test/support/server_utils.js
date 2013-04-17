var utils = {};

utils.startOnNextPort = function(server, issue, start_port) {

    var port = start_port || 5555;

    server.on('error', function(e) {
      console.log("Port " + port + " already in use, retrying");
      utils.startOnNextPort(server, issue, port+1);
    });

    server.listen(port, '127.0.0.1', issue);
}

module.exports = utils;


