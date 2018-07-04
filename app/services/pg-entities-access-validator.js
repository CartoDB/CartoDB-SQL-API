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

function isForbiddenEntity (table) {
    return FORBIDDEN_ENTITIES[table.schema_name] &&
        FORBIDDEN_ENTITIES[table.schema_name].length && (
            FORBIDDEN_ENTITIES[table.schema_name][0] === '*' ||
            FORBIDDEN_ENTITIES[table.schema_name].includes(table.table_name)
        );
}

function isSystemEntity (table) {
    return table.table_name.match(/\bpg_/;
}

module.exports = class Validator {
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
