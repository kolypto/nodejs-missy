'use strict';

/** Definitions for options objects and utility methods
 * @fileOverview
 */

var _ = require('lodash')
    ;

/** Schema options
 *
 * @interface
 */
var SchemaSettings = exports.SchemaSettings = function(){
};
SchemaSettings.prepare = function(schema, settings){
    return settings;
};

/** Model options
 *
 * @property {String} table
 *      Table name to use.
 * @property {Array.<String>} pk
 *      Primary key column[s]
 * @property {Boolean?} [required=false]
 *      Default value for fields which are missing the `required` definition field
 *
 * @property {Object.<String, Function>} hooks
 *      Hooks defined for the model.
 *      Every hook can optionally return a promise.
 * @property {function(entity: Object):Q?} hooks.afterFind
 *      After the entity was loaded from the database: .get(), .findOne(), .find()
 * @property {function(entity: Object):Q?} hooks.beforeInsert
 *      Before the entity is inserted: .insert()
 * @property {function(entity: Object):Q?} hooks.afterInsert
 *      After the entity was inserted: .insert()
 * @property {function(entity: Object):Q?} hooks.beforeUpdate
 *      Before the entity is updated: .update()
 * @property {function(entity: Object):Q?} hooks.afterUpdate
 *      After the entity was updated: .update()
 * @property {function(entity: Object):Q?} hooks.beforeSave
 *      Before the entity is saved: .save()
 * @property {function(entity: Object):Q?} hooks.afterSave
 *      After the entity is saved: .save()
 * @property {function(entity: Object):Q?} hooks.beforeRemove
 *      Before the entity is removed: .remove()
 * @property {function(entity: Object):Q?} hooks.afterRemove
 *      After the entity was removed: .remove()
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
        required: false
    });
    // Normalize
    options.pk = [].concat(options.pk);
    options.hooks = options.hooks || {};
    return options;
};
