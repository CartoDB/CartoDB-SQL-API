require('../helper');

var _      = require('underscore')
  , PSQL   = require('../../app/models/psql')
  , assert = require('assert');

exports['test throws error if no args passed to constructor'] = function(){  
  try{
    var pg = new PSQL();    
  } catch (err){
    assert.equal(err.message, "database user or name must be specified");
  }  
};

exports['test instantiate with just user constructor'] = function(){  
  var pg = new PSQL("1", null);
  assert.equal(pg.user_id, "1");
};

exports['test instantiate with just db constructor'] = function(){  
  var pg = new PSQL(null, 'my_database');
  assert.equal(pg.db, "my_database");
};

exports['test username returns default user if not set'] = function(){  
  var pg = new PSQL(null, 'my_database');
  assert.equal(pg.username(), "publicuser");
};

exports['test username returns interpolated user if set'] = function(){  
  var pg = new PSQL('simon', 'my_database');
  assert.equal(pg.username(), "test_cartodb_user_simon");
};

exports['test username returns default db if user not set'] = function(){  
  var pg = new PSQL(null, 'my_database');
  assert.equal(pg.database(), "my_database");
};

exports['test username returns interpolated db if user set'] = function(){  
  var pg = new PSQL('simon');
  assert.equal(pg.database(), "cartodb_test_user_simon_db");
};

exports['test can connect to db'] = function(){  
  var pg = new PSQL('simon');
  pg.connect(function(err, client){
    assert.equal(client.connected, true);
    pg.end();
  });
};

exports['test private user can execute SELECTS on db'] = function(){  
  var pg = new PSQL('simon');
  var sql = "SELECT 1 as test_sum"
  pg.query(sql, function(err, result){
    assert.equal(result.rows[0].test_sum, 1);
    pg.end();
  });
};

exports['test private user can execute CREATE on db'] = function(){  
  var pg = new PSQL('simon');
  var sql = "DROP TABLE IF EXISTS distributors; CREATE TABLE distributors (id integer, name varchar(40), UNIQUE(name))"
  pg.query(sql, function(err, result){
    assert.isNull(err);
    pg.end();
  });
};

exports['test private user can execute INSERT on db'] = function(){  
  var pg = new PSQL('simon');
  var sql = "DROP TABLE IF EXISTS distributors1; CREATE TABLE distributors1 (id integer, name varchar(40), UNIQUE(name))"
  pg.query(sql, function(err, result){
    sql = "INSERT INTO distributors1 (id, name) VALUES (1, 'fish')"
    pg.query(sql,function(err, result){
      assert.eql(result.rows, []);
      pg.end();
    });
  });
};

exports['test publicuser can execute SELECT on enabled tables'] = function(){  
  var pg = new PSQL("simon");    
  var sql = "DROP TABLE IF EXISTS distributors2; CREATE TABLE distributors2 (id integer, name varchar(40), UNIQUE(name)); GRANT SELECT ON distributors2 TO publicuser;"  
  pg.query(sql, function(err, result){
    pg.end();
    
    pg = new PSQL(null, 'cartodb_test_user_simon_db');    
    pg.query("SELECT count(*) FROM distributors2", function(err, result){
      assert.equal(result.rows[0].count, 0);
      pg.end();      
    });
  });
}

exports['test publicuser cannot execute INSERT on db'] = function(){
  var pg = new PSQL("simon");     
  var sql = "DROP TABLE IF EXISTS distributors3; CREATE TABLE distributors3 (id integer, name varchar(40), UNIQUE(name)); GRANT SELECT ON distributors3 TO publicuser;"
  pg.query(sql, function(err, result){    
    pg.end();
    
    pg = new PSQL(null, 'cartodb_test_user_simon_db'); //anonymous user
    pg.query("INSERT INTO distributors3 (id, name) VALUES (1, 'fishy')", function(err, result){
      assert.eql(err.message, 'permission denied for relation distributors3')
      pg.end();      
    });
  });
}
