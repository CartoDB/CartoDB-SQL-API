'use strict';

var _    = require('underscore'),
    util = require('util'),
    SORT_ORDER_OPTIONS = {ASC: 1, DESC: 1},
    REGEX_SELECT = /^\s*SELECT\s/i,
    REGEX_INTO = /\sINTO\s+([^\s]+|"([^"]|"")*")\s*$/i;

function PSQLWrapper(sql) {
    this.sqlQuery = sql.replace(/;\s*$/, '');
    this.sqlClauses = {
        orderBy: '',
        limit: ''
    };
}

/**
 * Only window select functions (NOTE: "values" will be broken, "with" will be broken)
 *
 * @param {number} limit
 * @param {number} offset
 * @returns {PSQLWrapper}
 */
PSQLWrapper.prototype.window = function (limit, offset) {
    if (!_.isNumber(limit) || !_.isNumber(offset)) {
        return this;
    }
    this.sqlClauses.limit = util.format(' LIMIT %d OFFSET %d', limit, offset);
    return this;
};

/**
 *
 * @param {string} column The name of the column to sort by
 * @param {string} sortOrder Whether it's ASC or DESC ordering
 * @returns {PSQLWrapper}
 */
PSQLWrapper.prototype.orderBy = function (column, sortOrder) {
    if (!_.isString(column) || _.isEmpty(column)) {
        return this;
    }
    this.sqlClauses.orderBy = util.format(' ORDER BY "%s"', column);

    if (!_.isUndefined(sortOrder)) {
        sortOrder = sortOrder.toUpperCase();
        if (SORT_ORDER_OPTIONS[sortOrder]) {
            this.sqlClauses.orderBy += util.format(' %s', sortOrder);
        }
    }
    return this;
};

/**
 * Builds an SQL query with extra clauses based on the builder calls.
 *
 * @returns {string} The SQL query with the extra clauses
 */
PSQLWrapper.prototype.query = function () {
    if (_.isEmpty(this.sqlClauses.orderBy) && _.isEmpty(this.sqlClauses.limit)) {
        return this.sqlQuery;
    }
    // Strip comments
    this.sqlQuery = this.sqlQuery.replace(/(^|\n)\s*--.*\n/g, '');

    var cte = '';

    if (this.sqlQuery.match(/^\s*WITH\s/i)) {

        var rem = this.sqlQuery, // analyzed portion of sql
            q, // quote char
            n = 0, // nested parens level
            s = 0, // 0:outQuote, 1:inQuote
            l;
        while (1) {
            l = rem.search(/[("')]/);
            // console.log("REM Is " + rem);
            if (l < 0) {
                // console.log("Malformed SQL");
                return this.sqlQuery;
            }
            var f = rem.charAt(l);
            // console.log("n:" + n + " s:" + s + " l:" + l + " charAt(l):" + f + " charAt(l+1):" + rem.charAt(l+1));
            if (s == 0) {
                if (f == '(') {
                    ++n;
                } else if (f == ')') {
                    if (!--n) { // end of CTE
                        cte += rem.substr(0, l + 1);
                        rem = rem.substr(l + 1);
                        //console.log("Out of cte, rem is " + rem);
                        if (rem.search(/^s*,/) < 0) {
                            break;
                        } else {
                            continue; // cte and rem already updated
                        }
                    }
                } else { // enter quoting
                    s = 1;
                    q = f;
                }
            } else if (f == q) {
                if (rem.charAt(l + 1) == f) {
                    ++l; // escaped
                } else {
                    s = 0; // exit quoting
                }
            }
            cte += rem.substr(0, l + 1);
            rem = rem.substr(l + 1);
        }
        /*
         console.log("cte: " + cte);
         console.log("rem: " + rem);
         */
        this.sqlQuery = rem; //sql.substr(l+1);
    }

    //console.log("SQL " + sql);
    //console.log(" does " + ( sql.match(REGEX_SELECT) ? '' : 'not ' ) + "match REGEX_SELECT " + REGEX_SELECT);
    //console.log(" does " + ( sql.match(REGEX_INTO) ? '' : 'not ' ) + "match REGEX_INTO " + REGEX_INTO);

    if (this.sqlQuery.match(REGEX_SELECT) && !this.sqlQuery.match(REGEX_INTO)) {
        return util.format(
            '%sSELECT * FROM (%s) AS cdbq_1%s%s',
            cte, this.sqlQuery, this.sqlClauses.orderBy, this.sqlClauses.limit
        );
    }

    return cte + this.sqlQuery;
};

module.exports = PSQLWrapper;
