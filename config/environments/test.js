module.exports.environment  = 'test';
module.exports.db_base_name = 'cartodb_test_user_<%= user_id %>_db';
module.exports.db_user      = 'test_cartodb_user_<%= user_id %>';
module.exports.db_host      = 'localhost';
module.exports.db_port      = '5432';
module.exports.redis_host   = '127.0.0.1';
module.exports.redis_port   = 6379;
module.exports.node_port    = 3000;

