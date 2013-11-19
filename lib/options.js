'use strict';

/** Definitions for options objects and utility methods
 * @fileOverview
 */

var _ = require('lodash')
    ;

/** Schema options
 *
 *
 *
 * @interface
 */
var SchemaSettings = exports.SchemaSettings = function(){
};

/** Model options
 *
 * @property {String} table
 *      Table name to use.
 * @property {Array.<String>} pk
 *      Primary key column[s]
 * @property {Boolean?} required
 *      Default value for fields which are missing the `required` definition field
 *
 * @interface
 */
var ModelOptions = exports.ModelOptions = function(){
};
ModelOptions.prepare = function(model, options){
    // Defaults
    options = _.defaults(options || {}, {
        table: model.name.toLowerCase() + 's',
        pk: 'id'
    });
    // Normalize
    options.pk = [].concat(options.pk);
    return options;
};
