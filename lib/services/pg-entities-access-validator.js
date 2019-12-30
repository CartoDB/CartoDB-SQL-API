'use strict';

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

const Validator = {
    validate (affectedTables, authorizationLevel) {
        let hardValidationResult = true;
        let softValidationResult = true;

        if (!!affectedTables && affectedTables.tables) {
            if (global.settings.validatePGEntitiesAccess) {
                hardValidationResult = this.hardValidation(affectedTables.tables);
            }

            if (authorizationLevel !== 'master') {
                softValidationResult = this.softValidation(affectedTables.tables);
            }
        }

        return hardValidationResult && softValidationResult;
    },

    hardValidation (tables) {
        for (const table of tables) {
            if (FORBIDDEN_ENTITIES[table.schema_name] && FORBIDDEN_ENTITIES[table.schema_name].length &&
                (
                    FORBIDDEN_ENTITIES[table.schema_name][0] === '*' ||
                    FORBIDDEN_ENTITIES[table.schema_name].includes(table.table_name)
                )
            ) {
                return false;
            }
        }

        return true;
    },

    softValidation (tables) {
        for (const table of tables) {
            if (table.table_name.match(/\bpg_/)) {
                return false;
            }
        }

        return true;
    }
};

module.exports = Validator;
