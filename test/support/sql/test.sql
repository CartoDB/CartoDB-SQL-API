--
-- sql-api test database
--
-- To use:
--
-- > dropdb -Upostgres -hlocalhost  cartodb_test_user_1_db
-- > createdb -Upostgres -hlocalhost -Ttemplate_postgis -Opostgres -EUTF8 cartodb_test_user_1_db
-- > psql -Upostgres -hlocalhost cartodb_test_user_1_db < test.sql
--
-- NOTE: requires a postgis template called template_postgis with CDB functions included
--

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET search_path = public, cartodb, pg_catalog;
SET default_tablespace = '';
SET default_with_oids = false;

-- first table
DROP TABLE IF EXISTS untitle_table_4;
CREATE TABLE untitle_table_4 (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id integer NOT NULL,
    name character varying,
    address character varying,
    -- NOTE: the_geom_webmercator is intentionally listed _before_ the_geom
    --       see https://github.com/CartoDB/CartoDB-SQL-API/issues/116
    the_geom_webmercator geometry,
    the_geom geometry,
    CONSTRAINT enforce_dims_the_geom CHECK ((st_ndims(the_geom) = 2)),
    CONSTRAINT enforce_dims_the_geom_webmercator CHECK ((st_ndims(the_geom_webmercator) = 2)),
    CONSTRAINT enforce_geotype_the_geom CHECK (((geometrytype(the_geom) = 'POINT'::text) OR (the_geom IS NULL))),
    CONSTRAINT enforce_geotype_the_geom_webmercator CHECK (((geometrytype(the_geom_webmercator) = 'POINT'::text) OR (the_geom_webmercator IS NULL))),
    CONSTRAINT enforce_srid_the_geom CHECK ((st_srid(the_geom) = 4326)),
    CONSTRAINT enforce_srid_the_geom_webmercator CHECK ((st_srid(the_geom_webmercator) = 3857))
);

CREATE SEQUENCE untitle_table_4_cartodb_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE untitle_table_4_cartodb_id_seq OWNED BY untitle_table_4.cartodb_id;

SELECT pg_catalog.setval('untitle_table_4_cartodb_id_seq', 60, true);

ALTER TABLE untitle_table_4 ALTER COLUMN cartodb_id SET DEFAULT nextval('untitle_table_4_cartodb_id_seq'::regclass);

INSERT INTO untitle_table_4
(updated_at, created_at, cartodb_id, name, address, the_geom, the_geom_webmercator)
VALUES
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 1, 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440', '0101000020110F000076491621312319C122D4663F1DCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 2, 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440', '0101000020110F0000C4356B29423319C15DD1092DADCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 3, 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440', '0101000020110F000053E71AC64D3419C10F664E4659CC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 4, 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440', '0101000020110F00005DACDB056F2319C1EC41A980FCCA5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 5, 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440', '0101000020110F00005F716E91992A19C17DAAA4D6DACC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21', -1, 'Test', 'Fake for testing', 'SRID=4326;POINT(33 16)', 'SRID=3857;POINT(3673543.19617803 1804722.76625729)');

ALTER TABLE ONLY untitle_table_4 ADD CONSTRAINT untitle_table_4_pkey PRIMARY KEY (cartodb_id);

CREATE INDEX untitle_table_4_the_geom_idx ON untitle_table_4 USING gist (the_geom);
CREATE INDEX untitle_table_4_the_geom_webmercator_idx ON untitle_table_4 USING gist (the_geom_webmercator);

-- second table
DROP TABLE IF EXISTS scoped_table_1;
CREATE TABLE scoped_table_1 (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id integer NOT NULL,
    name character varying,
    address character varying,
    the_geom_webmercator geometry,
    the_geom geometry,
    CONSTRAINT enforce_dims_the_geom CHECK ((st_ndims(the_geom) = 2)),
    CONSTRAINT enforce_dims_the_geom_webmercator CHECK ((st_ndims(the_geom_webmercator) = 2)),
    CONSTRAINT enforce_geotype_the_geom CHECK (((geometrytype(the_geom) = 'POINT'::text) OR (the_geom IS NULL))),
    CONSTRAINT enforce_geotype_the_geom_webmercator CHECK (((geometrytype(the_geom_webmercator) = 'POINT'::text) OR (the_geom_webmercator IS NULL))),
    CONSTRAINT enforce_srid_the_geom CHECK ((st_srid(the_geom) = 4326)),
    CONSTRAINT enforce_srid_the_geom_webmercator CHECK ((st_srid(the_geom_webmercator) = 3857))
);

CREATE SEQUENCE scoped_table_1_cartodb_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE scoped_table_1_cartodb_id_seq OWNED BY scoped_table_1.cartodb_id;

SELECT pg_catalog.setval('scoped_table_1_cartodb_id_seq', 60, true);

ALTER TABLE scoped_table_1 ALTER COLUMN cartodb_id SET DEFAULT nextval('scoped_table_1_cartodb_id_seq'::regclass);

INSERT INTO scoped_table_1
(updated_at, created_at, cartodb_id, name, address, the_geom, the_geom_webmercator)
VALUES
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 1, 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440', '0101000020110F000076491621312319C122D4663F1DCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 2, 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440', '0101000020110F0000C4356B29423319C15DD1092DADCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 3, 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440', '0101000020110F000053E71AC64D3419C10F664E4659CC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 4, 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440', '0101000020110F00005DACDB056F2319C1EC41A980FCCA5241');

ALTER TABLE ONLY scoped_table_1 ADD CONSTRAINT scoped_table_1_pkey PRIMARY KEY (cartodb_id);

CREATE INDEX scoped_table_1_the_geom_idx ON scoped_table_1 USING gist (the_geom);
CREATE INDEX scoped_table_1_the_geom_webmercator_idx ON scoped_table_1 USING gist (the_geom_webmercator);

-- private table
DROP TABLE IF EXISTS private_table;
CREATE TABLE private_table (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id integer NOT NULL,
    name character varying,
    address character varying,
    the_geom geometry,
    the_geom_webmercator geometry,
    CONSTRAINT enforce_dims_the_geom CHECK ((st_ndims(the_geom) = 2)),
    CONSTRAINT enforce_dims_the_geom_webmercator CHECK ((st_ndims(the_geom_webmercator) = 2)),
    CONSTRAINT enforce_geotype_the_geom CHECK (((geometrytype(the_geom) = 'POINT'::text) OR (the_geom IS NULL))),
    CONSTRAINT enforce_geotype_the_geom_webmercator CHECK (((geometrytype(the_geom_webmercator) = 'POINT'::text) OR (the_geom_webmercator IS NULL))),
    CONSTRAINT enforce_srid_the_geom CHECK ((st_srid(the_geom) = 4326)),
    CONSTRAINT enforce_srid_the_geom_webmercator CHECK ((st_srid(the_geom_webmercator) = 3857))
);

CREATE SEQUENCE untitle_table_4_cartodb_id_seq_p
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE untitle_table_4_cartodb_id_seq_p OWNED BY private_table.cartodb_id;

SELECT pg_catalog.setval('untitle_table_4_cartodb_id_seq_p', 60, true);

ALTER TABLE private_table ALTER COLUMN cartodb_id SET DEFAULT nextval('untitle_table_4_cartodb_id_seq_p'::regclass);

INSERT INTO private_table VALUES
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 1, 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440', '0101000020110F000076491621312319C122D4663F1DCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 2, 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440', '0101000020110F0000C4356B29423319C15DD1092DADCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 3, 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440', '0101000020110F000053E71AC64D3419C10F664E4659CC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 4, 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440', '0101000020110F00005DACDB056F2319C1EC41A980FCCA5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 5, 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440', '0101000020110F00005F716E91992A19C17DAAA4D6DACC5241');

ALTER TABLE ONLY private_table ADD CONSTRAINT untitle_table_4_pkey_p PRIMARY KEY (cartodb_id);

CREATE INDEX untitle_table_4_the_geom_idx_p ON private_table USING gist (the_geom);
CREATE INDEX untitle_table_4_the_geom_webmercator_idx_p ON private_table USING gist (the_geom_webmercator);

-- public user role
DROP USER IF EXISTS :PUBLICUSER;
CREATE USER :PUBLICUSER WITH PASSWORD ':PUBLICPASS';
ALTER ROLE :PUBLICUSER SET statement_timeout = 2000;
GRANT SELECT ON TABLE scoped_table_1 TO :PUBLICUSER;
GRANT USAGE ON SCHEMA cartodb TO :PUBLICUSER;
GRANT ALL ON CDB_TableMetadata TO :PUBLICUSER;

-- regular user role 1
DROP USER IF EXISTS regular_1;
CREATE USER regular_1 WITH PASSWORD 'regular1';
ALTER ROLE regular_1 SET statement_timeout = 2000;

GRANT ALL ON TABLE scoped_table_1 TO regular_1;
GRANT ALL ON SEQUENCE scoped_table_1_cartodb_id_seq TO regular_1;
GRANT USAGE ON SCHEMA cartodb TO regular_1;
GRANT ALL ON CDB_TableMetadata TO regular_1;

-- regular user role 2
DROP USER IF EXISTS regular_2;
CREATE USER regular_2 WITH PASSWORD 'regular2';
ALTER ROLE regular_2 SET statement_timeout = 2000;
GRANT USAGE ON SCHEMA cartodb TO regular_2;
GRANT ALL ON CDB_TableMetadata TO regular_2;

-- fallback user role
DROP USER IF EXISTS test_cartodb_user_2;
CREATE USER test_cartodb_user_2 WITH PASSWORD 'test_cartodb_user_2_pass';
GRANT ALL ON TABLE scoped_table_1 TO test_cartodb_user_2;
GRANT ALL ON SEQUENCE scoped_table_1_cartodb_id_seq TO test_cartodb_user_2;
GRANT USAGE ON SCHEMA cartodb TO test_cartodb_user_2;
GRANT ALL ON CDB_TableMetadata TO test_cartodb_user_2;

-- db owner role
DROP USER IF EXISTS :TESTUSER;
CREATE USER :TESTUSER WITH PASSWORD ':TESTPASS';

GRANT USAGE ON SCHEMA cartodb TO :TESTUSER;
GRANT ALL ON CDB_TableMetadata TO :TESTUSER;

GRANT ALL ON TABLE untitle_table_4 TO :TESTUSER;
GRANT SELECT ON TABLE untitle_table_4 TO :PUBLICUSER;
GRANT ALL ON TABLE private_table TO :TESTUSER;
GRANT ALL ON TABLE scoped_table_1 TO :TESTUSER;
GRANT ALL ON SEQUENCE untitle_table_4_cartodb_id_seq_p TO :TESTUSER;

GRANT ALL ON TABLE spatial_ref_sys TO :TESTUSER, :PUBLICUSER;

REVOKE ALL ON geometry_columns FROM public;
GRANT ALL ON geometry_columns TO :TESTUSER;
GRANT ALL ON geography_columns TO :TESTUSER;
GRANT SELECT ON geometry_columns TO :PUBLICUSER;
GRANT SELECT ON geography_columns TO :PUBLICUSER;

-- For https://github.com/CartoDB/CartoDB-SQL-API/issues/118
DROP TABLE IF EXISTS cpg_test;
CREATE TABLE cpg_test (a int);
GRANT ALL ON TABLE cpg_test TO :TESTUSER;
GRANT SELECT ON TABLE cpg_test TO :PUBLICUSER;


INSERT INTO CDB_TableMetadata (tabname, updated_at) VALUES ('untitle_table_4'::regclass, '2014-01-01T23:31:30.123Z');
INSERT INTO CDB_TableMetadata (tabname, updated_at) VALUES ('private_table'::regclass, '2015-01-01T23:31:30.123Z');
INSERT INTO CDB_TableMetadata (tabname, updated_at) VALUES ('scoped_table_1'::regclass, '2015-01-01T23:31:30.123Z');

GRANT SELECT ON CDB_TableMetadata TO :TESTUSER;
GRANT SELECT ON CDB_TableMetadata TO test_cartodb_user_2;

DROP TABLE IF EXISTS copy_endpoints_test;
CREATE TABLE copy_endpoints_test (
    id integer,
    name text,
    age integer default 10
);
GRANT ALL ON TABLE copy_endpoints_test TO :TESTUSER;
GRANT ALL ON TABLE copy_endpoints_test TO :PUBLICUSER;

DROP TABLE IF EXISTS pgtypes_table;
CREATE TABLE pgtypes_table (
    -- postgis type
    geography_point_4326 geography(point,4326),
    geometry_point_4326 geometry(point,4326),
    geometry_point_3857 geometry(point,3857),
    geometry_pointz_4326 geometry(pointz,4326),
    geometry_pointzm_4326 geometry(pointzm,4326),
    geography_line_4326 geography(linestring,4326),
    geometry_line_4326 geometry(linestring,4326),
    geometry_line_3857 geometry(linestring,3857),
    geometry_linez_4326 geometry(linestringz,4326),
    geometry_linezm_4326 geometry(linestringzm,4326),
    geography_polygon_4326 geography(polygon,4326),
    geometry_polygon_4326 geometry(polygon,4326),
    geometry_polygon_3857 geometry(polygon,3857),
    geometry_polygonz_4326 geometry(polygonz,4326),
    geometry_polygonzm_4326 geometry(polygonzm,4326),
    geography_multipoint_4326 geography(multipoint,4326),
    geometry_multipoint_4326 geometry(multipoint,4326),
    geometry_multipoint_3857 geometry(multipoint,3857),
    geometry_multipointz_4326 geometry(multipointz,4326),
    geometry_multipointzm_4326 geometry(multipointzm,4326),
    geography_multilinestring_4326 geography(multilinestring,4326),
    geometry_multilinestring_4326 geometry(multilinestring,4326),
    geometry_multilinestring_3857 geometry(multilinestring,3857),
    geometry_multilinestringz_4326 geometry(multilinestringz,4326),
    geometry_multilinestringzm_4326 geometry(multilinestringzm,4326),
    geography_multipolygon_4326 geography(multipolygon,4326),
    geometry_multipolygon_4326 geometry(multipolygon,4326),
    geometry_multipolygon_3857 geometry(multipolygon,3857),
    geometry_multipolygonz_4326 geometry(multipolygonz,4326),
    geometry_multipolygonzm_4326 geometry(multipolygonzm,4326),
    raster raster,
    -- common postgres types
    boolean boolean,
    smallint smallint,
    integer integer,
    bigint bigint,
    float double precision,
    real real,
    varchar varchar,
    text text,
    time time,
    date date,
    timestamp timestamp,
    timestamptz timestamptz,
    money money
);

GRANT ALL ON TABLE pgtypes_table TO :PUBLICUSER;
GRANT ALL ON TABLE pgtypes_table TO :TESTUSER;

INSERT INTO CDB_TableMetadata (tabname, updated_at) VALUES ('pgtypes_table'::regclass, '2015-01-01T23:31:30.123Z');
