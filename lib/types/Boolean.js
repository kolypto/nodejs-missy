'use strict';

var _ = require('lodash'),
    interfaces = require('../interfaces')
    ;

/** Boolean type handler
 * @constructor
 * @implements {IMissyTypeHandler}
 */
var TypeHandler = exports.Boolean = function(schema, name){
    interfaces.IMissyTypeHandler.apply(this, arguments);
};

TypeHandler.prototype.norm = function(value, field){
    if (!field.required && (_.isNull(value) || _.isUndefined(value)))
        return null;
    return !!{
        'true':1,
        't':1,
        '1':1,
        'y':1,
        'yes':1,
        'false':0,
        'f':0,
        '0':0,
        'n':0,
        'no':0
    }[ ''+value ];
};

TypeHandler.prototype.load = TypeHandler.prototype.norm;

TypeHandler.prototype.save = TypeHandler.prototype.norm;
