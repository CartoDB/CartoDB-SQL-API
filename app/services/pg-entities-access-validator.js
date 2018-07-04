const FORBIDDEN_ENTITIES = {
    carto: ['*'],
    cartodb: [
        'cdb_analysis_catalog',
        'cdb_conf',
        'cdb_tablemetadata'
    ],
    pg_catalog: ['*'],
    information_schema: ['*'],
    public: ['spatial_ref_sys'],
    topology: [
        'layer',
        'topology'
    ]
};

function isForbiddenTable (schema, table) {
    return FORBIDDEN_ENTITIES[schema] && FORBIDDEN_ENTITIES[schema].includes(table);
}

function isForbiddenSchema (schema) {
    return FORBIDDEN_ENTITIES[schema] && FORBIDDEN_ENTITIES[schema][0] === '*';
}

function isForbiddenEntity (entity) {
    const { schema_name: schema, table_name: table } = entity;

    return isForbiddenSchema(schema) || isForbiddenTable(schema, table);
}

function isSystemEntity (entity) {
    const { table_name: table } = entity;
    return table.match(/\bpg_/);
}

module.exports = class PGEntitiesAccessValidator {
    validate(affectedTables, authorizationLevel) {
        let hardValidationResult = true;
        let softValidationResult = true;

        if (!!affectedTables && affectedTables.tables) {
            if (global.settings.validatePGEntitiesAccess) {
                hardValidationResult = this._hardValidation(affectedTables.tables);
            }

            if (authorizationLevel !== 'master') {
                softValidationResult = this._softValidation(affectedTables.tables);
            }
        }

        return hardValidationResult && softValidationResult;
    }

    _hardValidation(tables) {
        for (let table of tables) {
            if (isForbiddenEntity(table)) {
                return false;
            }
        }

        return true;
    }

    _softValidation(tables) {
        for (let table of tables) {
            if (isSystemEntity(table)) {
                return false;
            }
        }

        return true;
    }
};
