'use strict';

/** Interfaces
 * @fileOverview
 */

/** Model field definition
 *
 * @property {String} type
 *      The field type (String)
 * @property {Boolean?} [required=false]
 *      Whether the field is required.
 *      A field is "missing" when it's `undefined` or `null`.
 *      TypeHandlers often case a "missing" value to `null`. A required field is always correctly casted to its type.
 * @property {*|function(this:Model)?} def
 *      The default value for the field.
 *      Can either be a value, or a callback bound to a model.
 *      Is assigned to a field when it's `undefined` (`null` won't be replaced by a default value).
 *      Then default value will also go through the type handler.
 *
 * Internal properties:
 * @property {String} name
 *      Field name
 * @property {IMissyTypeHandler} _typeHandler
 *      The field type handler
 * @property {Model} _model
 *      The related model
 *
 * @interface
 */
var IModelFieldDefinition = exports.IModelFieldDefinition = function(){
};



/** Query context. Used in hooks.
 *
 * @property {Model} model
 *      Model the query is executed on
 * @property {MissyCriteria?} criteria
 *      Search criteria, if available on the query
 * @property {MissyProjection?} projection
 *      Projection, if available on the query
 * @property {MissySort?} sort
 *      Sorting, if available on the query
 * @property {Object?} options
 *      Driver options
 * @property {Object?} entity
 *      The entity being handled (write ops)
 *
 * @interface
 */
var IModelContext = exports.IModelContext = function(){};



/** Data type handler for Missy
 *
 * @property {Schema} schema
 *      The schema
 * @property {String} name
 *      Data type name in the schema
 *
 * @interface
 */
var IMissyTypeHandler = exports.IMissyTypeHandler = function(schema, name){
    this.schema = schema;
    this.name = name;
};

/** Normalize a value got from the external user
 * @param {*} value
 *      The value
 * @param {IModelFieldDefinition} field
 *      Field definition
 * @returns {*}
 */
IMissyTypeHandler.prototype.norm = function(value, field){
};

/** Prepare a value loaded from the DB
 * @param {*} value
 *      The loaded value
 * @param {IModelFieldDefinition} field
 *      Field definition
 * @returns {*}
 */
IMissyTypeHandler.prototype.load = function(value, field){
};

/** Prepare a value to be saved to the DB
 * @param {*} value
 *      The loaded value
 * @param {IModelFieldDefinition} field
 *      Field definition
 * @returns {*}
 */
IMissyTypeHandler.prototype.save = function(value, field){
};



/** Abstract Driver for Missy
 *
 * @param {*} client
 *      The DB client, connected
 *
 * @interface
 */
var IMissyDriver = exports.IMissyDriver = function(client){
};

/** Bind the driver to a schema.
 * It can define custom types here.
 * @param {Schema} schema
 */
IMissyDriver.prototype.bindSchema = function(schema){
    this.schema = schema;
};

/** Find a single entity
 * @param {MissyCriteria} criteria
 * @param {MissyProjection} fields
 * @param {MissySort} sort
 * @param {Object} options
 * @returns {Q} promise for an entity, or NULL when not found
 */
IMissyDriver.prototype.findOne = function(criteria, fields, sort, options){
};

/** Find an array of entities
 * @param {MissyCriteria} criteria
 * @param {MissyProjection} fields
 * @param {MissySort} sort
 * @param {Object} options
 * @returns {Q} promise for an array of entities
 */
IMissyDriver.prototype.find = function(criteria, fields, sort, options){
};

/** Count the matching entities
 * @param {MissyCriteria} criteria
 * @param {Object} options
 * @returns {Q} promise for a number
 */
IMissyDriver.prototype.count = function(criteria, options){
};
