'use strict';

var _ = require('lodash'),
    interfaces = require('../interfaces')
    ;

/** Number type handler
 * @constructor
 * @implements {IMissyTypeHandler}
 */
var TypeHandler = exports.Number = function(schema, name){
    interfaces.IMissyTypeHandler.apply(this, arguments);
};

TypeHandler.prototype.norm = function(value, field){
    if (!field.required && (_.isNull(value) || _.isUndefined(value)))
        return null;
    value = +value;
    if (_.isNaN(value))
        return null;
    return value;
};

TypeHandler.prototype.load = TypeHandler.prototype.norm;

TypeHandler.prototype.save = TypeHandler.prototype.norm;
