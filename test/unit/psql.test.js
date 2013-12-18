require('../helper');

var _      = require('underscore')
  , PSQL   = require('../../app/models/psql')
  , assert = require('assert');

var public_user = global.settings.db_pubuser;

var dbopts_auth = {
  host: global.settings.db_host,
  port: global.settings.db_port,
  user: _.template(global.settings.db_user, {user_id: 1}),
  dbname: _.template(global.settings.db_base_name, {user_id: 1}),
  pass: _.template(global.settings.db_user_pass, {user_id: 1})
}

var dbopts_anon = _.clone(dbopts_auth);
dbopts_anon.user = global.settings.db_pubuser;
dbopts_anon.pass = global.settings.db_pubuser_pass;

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

test('test private user can execute SELECTS on db', function(done){  
  var pg = new PSQL(dbopts_auth);
  var sql = "SELECT 1 as test_sum";
  pg.query(sql, function(err, result){
    assert.ok(!err, err);
    assert.equal(result.rows[0].test_sum, 1);
    done();
  });
});

test('test private user can execute CREATE on db', function(done){  
  var pg = new PSQL(dbopts_auth);
  var sql = "DROP TABLE IF EXISTS distributors; CREATE TABLE distributors (id integer, name varchar(40), UNIQUE(name))";
  pg.query(sql, function(err, result){
    assert.ok(_.isNull(err));
    done();
  });
});

test('test private user can execute INSERT on db', function(done){  
  var pg = new PSQL(dbopts_auth);
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
  var pg = new PSQL(dbopts_auth);
  var sql = "DROP TABLE IF EXISTS distributors2; CREATE TABLE distributors2 (id integer, name varchar(40), UNIQUE(name)); GRANT SELECT ON distributors2 TO " + public_user + ";";
  pg.query(sql, function(err, result){
    pg = new PSQL(dbopts_anon)
    pg.query("SELECT count(*) FROM distributors2", function(err, result){
      assert.equal(result.rows[0].count, 0);
      done();
    });
  });
});

test('test public user cannot execute INSERT on db', function(done){
  var pg = new PSQL(dbopts_auth);
  var sql = "DROP TABLE IF EXISTS distributors3; CREATE TABLE distributors3 (id integer, name varchar(40), UNIQUE(name)); GRANT SELECT ON distributors3 TO " + public_user + ";";
  pg.query(sql, function(err, result){    
    
    pg = new PSQL(dbopts_anon);
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

test('dbkey depends on dbopts', function(){
  var opt1 = _.clone(dbopts_anon);
  opt1.dbname = 'dbname1';
  var pg1 = new PSQL(opt1);

  var opt2 = _.clone(dbopts_anon);
  opt2.dbname = 'dbname2';
  var pg2 = new PSQL(opt2);

  assert.ok(pg1.dbkey() !== pg2.dbkey(),
    'both PSQL object using same dbkey ' + pg1.dbkey());

  assert.ok(_.isString(pg1.dbkey()), "pg1 dbkey is " + pg1.dbkey());
});

});
