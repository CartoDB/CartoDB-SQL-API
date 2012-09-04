require('../helper');

var _      = require('underscore')
  , PSQL   = require('../../app/models/psql')
  , assert = require('assert');

suite('psql', function() {

test('test throws error if no args passed to constructor', function(){  
  var msg;
  try{
    var pg = new PSQL();
  } catch (err){
    msg = err.message;
  }  
  assert.equal(msg, "Incorrect access parameters. If you are accessing via OAuth, please check your tokens are correct. For public users, please ensure your table is published.");
});

test('test instantiate with just user constructor', function(){  
  var pg = new PSQL("1", null);
  assert.equal(pg.user_id, "1");
});

test('test instantiate with just db constructor', function(){  
  var pg = new PSQL(null, 'my_database');
  assert.equal(pg.db, "my_database");
});

test('test username returns default user if not set', function(){  
  var pg = new PSQL(null, 'my_database');
  assert.equal(pg.username(), "publicuser");
});

test('test username returns interpolated user if set', function(){  
  var pg = new PSQL('simon', 'my_database');
  assert.equal(pg.username(), "test_cartodb_user_simon");
});

test('test username returns default db if user not set', function(){  
  var pg = new PSQL(null, 'my_database');
  assert.equal(pg.database(), "my_database");
});

test('test username returns interpolated db if user set', function(){  
  var pg = new PSQL('simon');
  assert.equal(pg.database(), "cartodb_test_user_simon_db");
});

test('test private user can execute SELECTS on db', function(done){  
  var pg = new PSQL('1');
  var sql = "SELECT 1 as test_sum";
  pg.query(sql, function(err, result){
    assert.equal(result.rows[0].test_sum, 1);
    done();
  });
});

test('test private user can execute CREATE on db', function(done){  
  var pg = new PSQL('1');
  var sql = "DROP TABLE IF EXISTS distributors; CREATE TABLE distributors (id integer, name varchar(40), UNIQUE(name))";
  pg.query(sql, function(err, result){
    assert.ok(_.isNull(err));
    done();
  });
});

test('test private user can execute INSERT on db', function(done){  
  var pg = new PSQL('1');
  var sql = "DROP TABLE IF EXISTS distributors1; CREATE TABLE distributors1 (id integer, name varchar(40), UNIQUE(name))";
  pg.query(sql, function(err, result){
    sql = "INSERT INTO distributors1 (id, name) VALUES (1, 'fish')";
    pg.query(sql,function(err, result){
      assert.deepEqual(result.rows, []);
      done();
    });
  });
});

test('test publicuser can execute SELECT on enabled tables', function(done){  
  var pg = new PSQL("1");
  var sql = "DROP TABLE IF EXISTS distributors2; CREATE TABLE distributors2 (id integer, name varchar(40), UNIQUE(name)); GRANT SELECT ON distributors2 TO publicuser;";
  pg.query(sql, function(err, result){
    pg = new PSQL(null, 'cartodb_test_user_1_db');
    pg.query("SELECT count(*) FROM distributors2", function(err, result){
      assert.equal(result.rows[0].count, 0);
      done();
    });
  });
});

test('test publicuser cannot execute INSERT on db', function(done){
  var pg = new PSQL("1");
  var sql = "DROP TABLE IF EXISTS distributors3; CREATE TABLE distributors3 (id integer, name varchar(40), UNIQUE(name)); GRANT SELECT ON distributors3 TO publicuser;";
  pg.query(sql, function(err, result){    
    
    pg = new PSQL(null, 'cartodb_test_user_1_db'); //anonymous user
    pg.query("INSERT INTO distributors3 (id, name) VALUES (1, 'fishy')", function(err, result){
      assert.equal(err.message, 'permission denied for relation distributors3');
      done();
    });
  });
});

});
