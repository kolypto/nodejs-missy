'use strict';

var _ = require('lodash'),
    interfaces = require('../interfaces'),
    errors = require('../errors')
    ;

/** JSON type handler: serialized data
 * @constructor
 * @implements {IMissyTypeHandler}
 */
var TypeHandler = exports.JSON = function(schema, name){
    interfaces.IMissyTypeHandler.apply(this, arguments);
};

TypeHandler.prototype.norm = _.identity;

TypeHandler.prototype.load = function(value, field){
    if (_.isString(value))
        try { value = JSON.parse(value); }
        catch(e){ throw new errors.MissyTypeError(this, 'Failed to parse JSON: ' + e); }
    return value;
};

TypeHandler.prototype.save = function(value, field){
    if (!field.required && (_.isNull(value) || _.isUndefined(value)))
        return null;
    try { return JSON.stringify(value); }
    catch(e){ throw new errors.MissyTypeError(this, 'Failed to serialize JSON: ' + e); }
};
