CREATE OR REPLACE FUNCTION py_sleep(t FLOAT8)
RETURNS void AS $$
  import time
  time.sleep(t)
$$ LANGUAGE plpythonu;