-- See https://github.com/CartoDB/cartodb-postgresql/blob/master/scripts-available/CDB_Quota.sql

CREATE OR REPLACE FUNCTION _CDB_UserQuotaInBytes()
RETURNS int8 AS
$$
    -- 250 MB
    SELECT (250 * 1024 * 1024)::int8;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION CDB_UserDataSize(schema_name TEXT)
RETURNS bigint AS
$$
BEGIN
    -- 100 MB
    RETURN 100 * 1024 * 1024;
END;
$$ LANGUAGE 'plpgsql' VOLATILE;
