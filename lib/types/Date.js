'use strict';

var _ = require('lodash'),
    interfaces = require('../interfaces')
    ;

/** Date type handler
 * @constructor
 * @implements {IMissyTypeHandler}
 */
var TypeHandler = exports.Date = function(schema, name){
    interfaces.IMissyTypeHandler.apply(this, arguments);
};

TypeHandler.prototype.norm = function(value, field){
    if (!field.required && (_.isNull(value) || _.isUndefined(value)))
        return null;
    if (value instanceof Date)
        return value;
    // Try to create a date
    var d = new Date(value);
    if (isNaN( d.getTime() ))
        return null;
    return d;
};

TypeHandler.prototype.load = TypeHandler.prototype.norm;

TypeHandler.prototype.save = TypeHandler.prototype.norm;
