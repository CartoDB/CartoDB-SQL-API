require('../helper');

var _      = require('underscore')
  , PSQL   = require('../../app/models/psql')
  , assert = require('assert');

var public_user = global.settings.db_pubuser;

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
  assert.equal(pg.username(), public_user);
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

test('test public user can execute SELECT on enabled tables', function(done){  
  var pg = new PSQL("1");
  var sql = "DROP TABLE IF EXISTS distributors2; CREATE TABLE distributors2 (id integer, name varchar(40), UNIQUE(name)); GRANT SELECT ON distributors2 TO " + public_user + ";";
  pg.query(sql, function(err, result){
    pg = new PSQL(null, 'cartodb_test_user_1_db');
    pg.query("SELECT count(*) FROM distributors2", function(err, result){
      assert.equal(result.rows[0].count, 0);
      done();
    });
  });
});

test('test public user cannot execute INSERT on db', function(done){
  var pg = new PSQL("1");
  var sql = "DROP TABLE IF EXISTS distributors3; CREATE TABLE distributors3 (id integer, name varchar(40), UNIQUE(name)); GRANT SELECT ON distributors3 TO " + public_user + ";";
  pg.query(sql, function(err, result){    
    
    pg = new PSQL(null, 'cartodb_test_user_1_db'); //anonymous user
    pg.query("INSERT INTO distributors3 (id, name) VALUES (1, 'fishy')", function(err, result){
      assert.equal(err.message, 'permission denied for relation distributors3');
      done();
    });
  });
});

test('Windowed SQL with simple select', function(){
  // NOTE: intentionally mixed-case and space-padded
  var sql = "\n \tSEleCT * from table1";
  var out = PSQL.window_sql(sql, 1, 0);
  assert.equal(out, "SELECT * FROM (" + sql + ") AS cdbq_1 LIMIT 1 OFFSET 0");
});

test('Windowed SQL with CTE select', function(){
  // NOTE: intentionally mixed-case and space-padded
  var cte = "\n \twiTh  x as( update test set x=x+1)";
  var select = "\n \tSEleCT * from x";
  var sql = cte + select;
  var out = PSQL.window_sql(sql, 1, 0);
  assert.equal(out, cte + "SELECT * FROM (" + select + ") AS cdbq_1 LIMIT 1 OFFSET 0");
});

test('Windowed SQL with CTE update', function(){
  // NOTE: intentionally mixed-case and space-padded
  var cte = "\n \twiTh  a as( update test set x=x+1)";
  var upd = "\n \tupdate tost set y=x from x";
  var sql = cte + upd;
  var out = PSQL.window_sql(sql, 1, 0);
  assert.equal(out, sql);
});

test('Windowed SQL with complex CTE and insane quoting', function(){
  // NOTE: intentionally mixed-case and space-padded
  var cte = "\n \twiTh \"('a\" as( update \"\"\"test)\" set x='x'+1), \")b(\" as ( select ')))\"' from z )";
  var sel = "\n \tselect '\"' from x";
  var sql = cte + sel;
  var out = PSQL.window_sql(sql, 1, 0);
  assert.equal(out, cte + "SELECT * FROM (" + sel + ") AS cdbq_1 LIMIT 1 OFFSET 0");
});

});
