#!/bin/sh
# this script prepare database and redis instance to run accpetance test

echo "preparing redis..."
echo "HSET rails:users:vizzuality id 1" | redis-cli -n 5
echo "HSET rails:users:vizzuality database_name cartodb_test_user_1_db" | redis-cli -n 5
echo "SADD rails:users:vizzuality:map_key 1234" | redis-cli -n 5
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR consumer_key fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2" | redis-cli -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR consumer_secret IBLCvPEefxbIiGZhGlakYV4eM8AbVSwsHxwEYpzx" | redis-cli -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR access_token_token l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR" | redis-cli -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR access_token_secret 22zBIek567fMDEebzfnSdGe8peMFVFqAreOENaDK" | redis-cli -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR user_id 1" | redis-cli -n 3
echo "hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR time sometime" | redis-cli -n 3


echo "preparing postgres..."
dropdb -Upostgres -hlocalhost  cartodb_test_user_1_db
createdb -Upostgres -hlocalhost -Ttemplate_postgis -Opostgres -EUTF8 cartodb_test_user_1_db
psql -Upostgres -hlocalhost cartodb_test_user_1_db < test.sql


echo "ok, you can run test now"


