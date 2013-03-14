                 require('../helper');
var _          = require('underscore')
  , redis_pool = require('../../app/models/redis_pool')
  , assert     = require('assert');

suite('redis_pool', function() {

test('test truth', function(){
    assert.ok(true, 'it is');
});

test('test can instantiate a RedisPool object', function(){
  assert.ok(redis_pool);
});

test('test pool object has an aquire function', function(){
  assert.ok(_.includes(_.functions(redis_pool), 'acquire'));
});

test('test calling aquire returns a redis client object that can get/set', function(done){
  redis_pool.acquire(0, function(err, client){
    assert.ok(!err);
    client.set("key","value");
    client.get("key", function(err,data){      
      assert.equal(data, "value");      
      redis_pool.release(0, client);
      done();
    });
  });    
});

test('test calling aquire on another DB returns a redis client object that can get/set', function(done){
  redis_pool.acquire("MYDATABASE", function(err, client){
    assert.ok(!err);
    client.set("key","value");
    client.get("key", function(err,data){      
      assert.equal(data, "value");      
      redis_pool.release("MYDATABASE", client);
      redis_pool.acquire("MYDATABASE", function(err, client){
        assert.ok(!err);
        client.get("key", function(err,data){      
          assert.equal(data, "value");      
          redis_pool.release("MYDATABASE", client);
          done();
        });
      });      
    })
  });    
  
});

});
