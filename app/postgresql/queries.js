'use strict';

function pgQuoteCastMapper(cast) {
    return function(input) {
        return '\'' + input + '\'' + (cast ? ('::' + cast) : '');
    };
}
module.exports.pgQuoteCastMapper = pgQuoteCastMapper;

var EMPTY_ARRAY_SQL = '\'{}\'';
function pgArray(input, cast) {
    if (input.length === 0) {
        return cast ? ('ARRAY[]::' + cast + '[]') : EMPTY_ARRAY_SQL;
    }
    return 'ARRAY[' + input.join(', ') + ']';
}
module.exports.pgArray = pgArray;

var SUBSTITUTION_TOKENS = {
    bbox: /!bbox!/g,
    scale_denominator: /!scale_denominator!/g,
    pixel_width: /!pixel_width!/g,
    pixel_height: /!pixel_height!/g,
    var_zoom: /@zoom/g,
    var_bbox: /@bbox/g,
    var_x: /@x/g,
    var_y: /@y/g,
};

function replaceTokens(sql, replaceValues) {
    if (!sql) {
        return sql;
    }
    replaceValues = replaceValues || {
        bbox: 'ST_MakeEnvelope(0,0,0,0)',
        scale_denominator: '0',
        pixel_width: '1',
        pixel_height: '1',
        var_zoom: '0',
        var_bbox: '[0,0,0,0]',
        var_x: '0',
        var_y: '0'
    };
    Object.keys(replaceValues).forEach(function(token) {
        if (SUBSTITUTION_TOKENS[token]) {
            sql = sql.replace(SUBSTITUTION_TOKENS[token], replaceValues[token]);
        }
    });
    return sql;
}
module.exports.replaceTokens = replaceTokens;
