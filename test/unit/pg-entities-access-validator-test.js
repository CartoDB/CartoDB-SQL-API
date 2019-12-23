'use strict';

const assert = require('assert');
const pgEntitiesAccessValidator = require('../../lib/services/pg-entities-access-validator');

const fakeAffectedTables = [{
    schema_name: 'schema',
    table_name: 'untitled_table'
}];

const fakeAffectedTablesCarto = [{
    schema_name: 'carto',
    table_name: 'untitled_table'
}];

const fakeAffectedTablesCartodbOK = [{
    schema_name: 'cartodb',
    table_name: 'untitled_table'
}];

const fakeAffectedTablesCartodbKO = [
    {
        schema_name: 'cartodb',
        table_name: 'untitled_table'
    },
    {
        schema_name: 'cartodb',
        table_name: 'cdb_tablemetadata'
    }
];

const fakeAffectedTablesPgcatalog = [{
    schema_name: 'pg_catalog',
    table_name: 'pg_catalog'
}];

const fakeAffectedTablesInfo = [{
    schema_name: 'information_schema',
    table_name: 'untitled_table'
}];

const fakeAffectedTablesPublicOK = [{
    schema_name: 'public',
    table_name: 'untitled_table'
}];

const fakeAffectedTablesPublicKO = [
    {
        schema_name: 'public',
        table_name: 'spatial_ref_sys'
    },
    {
        schema_name: 'public',
        table_name: 'untitled_table'
    }
];

const fakeAffectedTablesTopologyOK = [{
    schema_name: 'topology',
    table_name: 'untitled_table'
}];

const fakeAffectedTablesTopologyKO = [
    {
        schema_name: 'topology',
        table_name: 'layer'
    },
    {
        schema_name: 'topology',
        table_name: 'untitled_table'
    }
];

describe('pg entities access validator with validatePGEntitiesAccess enabled', function () {
    before(function () {
        global.settings.validatePGEntitiesAccess = true;
    });

    after(function () {
        global.settings.validatePGEntitiesAccess = false;
    });

    it('validate function: bad parameters', function () {
        assert.strictEqual(pgEntitiesAccessValidator.validate(), true);
        assert.strictEqual(pgEntitiesAccessValidator.validate(null), true);
        assert.strictEqual(pgEntitiesAccessValidator.validate(null, null), true);
        assert.strictEqual(pgEntitiesAccessValidator.validate([]), true);
        assert.strictEqual(pgEntitiesAccessValidator.validate([], 3), true);
        assert.strictEqual(pgEntitiesAccessValidator.validate({ tables: [] }, false), true);
    });

    it('validate function: should be validated', function () {
        assert.strictEqual(pgEntitiesAccessValidator.validate({ tables: fakeAffectedTables }), true);
        assert.strictEqual(pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesCartodbOK }), true);
        assert.strictEqual(pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesPublicOK }), true);
        assert.strictEqual(pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesTopologyOK }), true);
    });

    it('validate function: should not be validated', function () {
        let authorizationLevel = 'master';
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesCarto }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesCartodbKO }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesPgcatalog }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesInfo }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesPublicKO }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesTopologyKO }, authorizationLevel),
            false
        );

        authorizationLevel = 'regular';
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesCarto }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesCartodbKO }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesPgcatalog }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesInfo }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesPublicKO }, authorizationLevel),
            false
        );
        assert.strictEqual(
            pgEntitiesAccessValidator.validate({ tables: fakeAffectedTablesTopologyKO }, authorizationLevel),
            false
        );
    });

    it('hardValidation function', function () {
        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTables), true);
        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTablesCartodbOK), true);
        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTablesPublicOK), true);
        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTablesTopologyOK), true);

        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTablesCarto), false);
        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTablesCartodbKO), false);
        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTablesPgcatalog), false);
        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTablesInfo), false);
        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTablesPublicKO), false);
        assert.strictEqual(pgEntitiesAccessValidator.hardValidation(fakeAffectedTablesTopologyKO), false);
    });

    it('softValidation function', function () {
        assert.strictEqual(pgEntitiesAccessValidator.softValidation(fakeAffectedTablesCartodbKO), true);
        assert.strictEqual(pgEntitiesAccessValidator.softValidation(fakeAffectedTablesPgcatalog), false);
    });
});
