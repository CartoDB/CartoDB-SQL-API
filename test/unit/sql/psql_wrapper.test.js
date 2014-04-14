var _           = require('underscore'),
    PSQLWrapper = require('../../../app/sql/psql_wrapper'),
    assert      = require('assert');


// NOTE: intentionally mixed-case and space-padded
var simpleSql = "\n \tSEleCT * from table1";

suite('psql_wrapper', function() {

    test('Windowed SQL with simple select', function(){
        var out = new PSQLWrapper(simpleSql).window(1, 0).query();

        assert.equal(out, "SELECT * FROM (" + simpleSql + ") AS cdbq_1 LIMIT 1 OFFSET 0");
    });

    test('Windowed SQL with CTE select', function(){
        // NOTE: intentionally mixed-case and space-padded
        var cte = "\n \twiTh  x as( update test set x=x+1)";
        var select = "\n \tSEleCT * from x";
        var sql = cte + select;

        var out = new PSQLWrapper(sql).window(1, 0).query();

        assert.equal(out, cte + "SELECT * FROM (" + select + ") AS cdbq_1 LIMIT 1 OFFSET 0");
    });

    test('Windowed SQL with CTE update', function(){
        // NOTE: intentionally mixed-case and space-padded
        var cte = "\n \twiTh  a as( update test set x=x+1)";
        var upd = "\n \tupdate tost set y=x from x";
        var sql = cte + upd;

        var out = new PSQLWrapper(sql).window(1, 0).query();

        assert.equal(out, sql);
    });

    test('Windowed SQL with complex CTE and insane quoting', function(){
        // NOTE: intentionally mixed-case and space-padded
        var cte = "\n \twiTh \"('a\" as( update \"\"\"test)\" set x='x'+1), \")b(\" as ( select ')))\"' from z )";
        var sel = "\n \tselect '\"' from x";
        var sql = cte + sel;

        var out = new PSQLWrapper(sql).window(1, 0).query();

        assert.equal(out, cte + "SELECT * FROM (" + sel + ") AS cdbq_1 LIMIT 1 OFFSET 0");
    });

    test('Different instances return different queries', function() {
        var aWrapper = new PSQLWrapper('select 1');
        var bWrapper = new PSQLWrapper('select * from databaseB');

        assert.notEqual(aWrapper, bWrapper);
        assert.notEqual(aWrapper.query(), bWrapper.query(), 'queries should be different');
    });

    test('Order by SQL with simple select and empty column name', function() {
        var expectedSql = 'SELECT * FROM (' + simpleSql + ') AS cdbq_1';

        var outputSql = new PSQLWrapper(simpleSql).orderBy('').query();

        assert.equal(outputSql, expectedSql);
    });

    test('Order by SQL with simple select and no sort order', function() {
        var expectedSql = 'SELECT * FROM (' + simpleSql + ') AS cdbq_1 ORDER BY "foo"';

        var outputSql = new PSQLWrapper(simpleSql).orderBy('foo').query();

        assert.equal(outputSql, expectedSql);
    });

    test('Order by SQL with simple select and invalid sort order use no sort order', function() {
        var expectedSql = 'SELECT * FROM (' + simpleSql + ') AS cdbq_1 ORDER BY "foo"';

        var outputSql = new PSQLWrapper(simpleSql).orderBy('foo', "BAD_SORT_ORDER").query();

        assert.equal(outputSql, expectedSql);
    });

    test('Order by SQL with simple select and asc order', function() {
        var expectedSql = 'SELECT * FROM (' + simpleSql + ') AS cdbq_1 ORDER BY "foo" ASC';

        var outputSql = new PSQLWrapper(simpleSql).orderBy('foo', "asc").query();

        assert.equal(outputSql, expectedSql);
    });

    test('Order by SQL with simple select and DESC order', function() {
        var expectedSql = 'SELECT * FROM (' + simpleSql + ') AS cdbq_1 ORDER BY "foo" DESC';

        var outputSql = new PSQLWrapper(simpleSql).orderBy('foo', "DESC").query();

        assert.equal(outputSql, expectedSql);
    });
});
