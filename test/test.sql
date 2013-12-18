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
SET search_path = public, pg_catalog;
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

CREATE SEQUENCE test_table_cartodb_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE test_table_cartodb_id_seq OWNED BY untitle_table_4.cartodb_id;

SELECT pg_catalog.setval('test_table_cartodb_id_seq', 60, true);

ALTER TABLE untitle_table_4 ALTER COLUMN cartodb_id SET DEFAULT nextval('test_table_cartodb_id_seq'::regclass);

INSERT INTO untitle_table_4
(updated_at, created_at, cartodb_id, name, address, the_geom, the_geom_webmercator)
VALUES
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 1, 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440', '0101000020110F000076491621312319C122D4663F1DCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 2, 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440', '0101000020110F0000C4356B29423319C15DD1092DADCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 3, 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440', '0101000020110F000053E71AC64D3419C10F664E4659CC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 4, 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440', '0101000020110F00005DACDB056F2319C1EC41A980FCCA5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 5, 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440', '0101000020110F00005F716E91992A19C17DAAA4D6DACC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21', -1, 'Test', 'Fake for testing', 'SRID=4326;POINT(33 16)', 'SRID=3857;POINT(3673543.19617803 1804722.76625729)');

ALTER TABLE ONLY untitle_table_4 ADD CONSTRAINT test_table_pkey PRIMARY KEY (cartodb_id);

CREATE INDEX test_table_the_geom_idx ON untitle_table_4 USING gist (the_geom);
CREATE INDEX test_table_the_geom_webmercator_idx ON untitle_table_4 USING gist (the_geom_webmercator);

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

CREATE SEQUENCE test_table_cartodb_id_seq_p
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE test_table_cartodb_id_seq_p OWNED BY private_table.cartodb_id;

SELECT pg_catalog.setval('test_table_cartodb_id_seq_p', 60, true);

ALTER TABLE private_table ALTER COLUMN cartodb_id SET DEFAULT nextval('test_table_cartodb_id_seq_p'::regclass);

INSERT INTO private_table VALUES
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 1, 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440', '0101000020110F000076491621312319C122D4663F1DCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 2, 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440', '0101000020110F0000C4356B29423319C15DD1092DADCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 3, 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440', '0101000020110F000053E71AC64D3419C10F664E4659CC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 4, 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440', '0101000020110F00005DACDB056F2319C1EC41A980FCCA5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 5, 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440', '0101000020110F00005F716E91992A19C17DAAA4D6DACC5241');

ALTER TABLE ONLY private_table ADD CONSTRAINT test_table_pkey_p PRIMARY KEY (cartodb_id);

CREATE INDEX test_table_the_geom_idx_p ON private_table USING gist (the_geom);
CREATE INDEX test_table_the_geom_webmercator_idx_p ON private_table USING gist (the_geom_webmercator);



CREATE USER :PUBLICUSER WITH PASSWORD ':PUBLICPASS';
CREATE USER :TESTUSER WITH PASSWORD ':TESTPASS';

GRANT ALL ON TABLE untitle_table_4 TO :TESTUSER;
GRANT SELECT ON TABLE untitle_table_4 TO :PUBLICUSER;
GRANT ALL ON TABLE private_table TO :TESTUSER;
GRANT ALL ON SEQUENCE test_table_cartodb_id_seq_p TO :TESTUSER;

GRANT ALL ON TABLE spatial_ref_sys TO :TESTUSER, :PUBLICUSER;

REVOKE ALL ON geometry_columns FROM public;
GRANT ALL ON geometry_columns TO :TESTUSER;

-- For https://github.com/CartoDB/CartoDB-SQL-API/issues/118
DROP TABLE IF EXISTS cpg_test;
CREATE TABLE cpg_test (a int);
GRANT ALL ON TABLE cpg_test TO :TESTUSER;
GRANT SELECT ON TABLE cpg_test TO :PUBLICUSER;
