module.exports.environment  = 'production';
module.exports.db_base_name = 'cartodb_user_<%= user_id %>_db';
module.exports.db_user      = 'cartodb_user_<%= user_id %>';
module.exports.db_host      = 'localhost';
module.exports.redis_host   = '127.0.0.1';
module.exports.redis_port   = 6379;
module.exports.node_port    = 3000;


