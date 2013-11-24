'use strict';

/** Definitions for options objects and utility methods
 * @fileOverview
 */

var _ = require('lodash')
    ;

/** Schema options
 *
 * @property {Boolean} [queryWhenConnected=false]
 *      When the DB driver is not connected, delay query execution until it connects.
 *      When `false`, this throws an exception instead.
 *
 * @interface
 */
var SchemaSettings = exports.SchemaSettings = function(){
};
SchemaSettings.prepare = function(schema, settings){
    // Defaults
    settings = _.defaults(settings || {}, {
        queryWhenConnected: false
    });
    return settings;
};

/** Model options
 *
 * @property {String} table
 *      Table name to use.
 * @property {Array.<String>} pk
 *      Primary key column[s]
 * @property {Boolean} [required=false]
 *      Default value for fields which are missing the `required` definition field
 * @property {Object?} entityPrototype
 *      The object to use as a prototype for loaded entities.
 *      This is the way of assigning methods to entities.
 *
 * @interface
 */
var ModelOptions = exports.ModelOptions = function(){
};
ModelOptions.prepare = function(model, options){
    // Defaults
    options = _.defaults(options || {}, {
        table: model.name.toLowerCase() + 's',
        pk: 'id',
        required: false,
        entityPrototype: undefined
    });
    // Normalize
    options.pk = [].concat(options.pk);
    return options;
};
