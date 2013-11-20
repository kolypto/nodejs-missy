'use strict';

var _ = require('lodash'),
    interfaces = require('../interfaces')
    ;

/** Object type handler
 * @constructor
 * @implements {IMissyTypeHandler}
 */
var TypeHandler = exports.Object = function(schema, name){
    interfaces.IMissyTypeHandler.apply(this, arguments);
};

TypeHandler.prototype.norm = function(value, field){
    if (!field.required && (_.isNull(value) || _.isUndefined(value) || !_.isObject(value)))
        return null;
    if (!_.isObject(value))
        return {};
    return value;
};

TypeHandler.prototype.load = TypeHandler.prototype.norm;

TypeHandler.prototype.save = TypeHandler.prototype.norm;
