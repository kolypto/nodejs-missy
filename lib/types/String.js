'use strict';

var _ = require('lodash'),
    interfaces = require('../interfaces')
    ;

/** String type handler
 * @constructor
 * @implements {IMissyTypeHandler}
 */
var TypeHandler = exports.String = function(schema, name){
    interfaces.IMissyTypeHandler.apply(this, arguments);
};

TypeHandler.prototype.norm = function(value, field){
    if (!field.required && (_.isNull(value) || _.isUndefined(value)))
        return null;
    if (_.isUndefined(value) || _.isNull(value))
        return ''; // otherwise, we'll get fancy 'null' and 'undefined'
    return ''+value;
};

TypeHandler.prototype.load = TypeHandler.prototype.norm;

TypeHandler.prototype.save = TypeHandler.prototype.norm;
