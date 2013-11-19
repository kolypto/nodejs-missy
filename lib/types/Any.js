'use strict';

var _ = require('lodash'),
    interfaces = require('../interfaces')
    ;

/** Any type handler: verbatim
 * @constructor
 * @implements {IMissyTypeHandler}
 */
var TypeHandler = exports.Any = function(schema, name){
    interfaces.IMissyTypeHandler.apply(this, arguments);
};

TypeHandler.prototype.norm = _.identity;

TypeHandler.prototype.load = _.identity;

TypeHandler.prototype.save = _.identity;
