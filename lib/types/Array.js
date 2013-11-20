'use strict';

var _ = require('lodash'),
    interfaces = require('../interfaces')
    ;

/** Array type handler
 * @constructor
 * @implements {IMissyTypeHandler}
 */
var TypeHandler = exports.Array = function(schema, name){
    interfaces.IMissyTypeHandler.apply(this, arguments);
};

TypeHandler.prototype.norm = function(value, field){
    if (!field.required && (_.isNull(value) || _.isUndefined(value)))
        return null;
    if (_.isArray(value))
        return value;
    if (_.isNull(value) || _.isUndefined(value))
        return [];
    return [].concat(value);
};

TypeHandler.prototype.load = TypeHandler.prototype.norm;

TypeHandler.prototype.save = TypeHandler.prototype.norm;
