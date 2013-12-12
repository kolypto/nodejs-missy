'use strict';

/** Built-in type handlers
 * @fileOverview
 */

exports.Any = require('./Any').Any;
exports.String = require('./String').String;
exports.Boolean = require('./Boolean').Boolean;
exports.Number = require('./Number').Number;
exports.Date = require('./Date').Date;
exports.Object = require('./Object').Object;
exports.Array = require('./Array').Array;
exports.JSON = require('./JSON').JSON;

/** Default Missy data type handlers
 * @type {Object.<String, IMissyTypeHandler>}
 */
exports.stdTypes = {
    'any': exports.Any,
    'string': exports.String,
    'number': exports.Number,
    'boolean': exports.Boolean,
    'date': exports.Date,
    'object': exports.Object,
    'array': exports.Array,
    'json': exports.JSON
};
