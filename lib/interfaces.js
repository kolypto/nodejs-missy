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
 * @param {Model} model
 * @param {MissyCriteria} criteria
 * @param {MissyProjection} fields
 * @param {MissySort} sort
 * @param {Object} options
 * @returns {Q} -> entity|null
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.findOne = function(model, criteria, fields, sort, options){
};

/** Find an array of entities
 * @param {Model} model
 * @param {MissyCriteria} criteria
 * @param {MissyProjection} fields
 * @param {MissySort} sort
 * @param {Object} options
 * @returns {Q} -> entities
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.find = function(model, criteria, fields, sort, options){
};

/** Get the number of matching entities
 * @param {Model} model
 * @param {MissyCriteria} criteria
 * @param {Object} options
 * @returns {Q} -> entity
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.count = function(model, criteria, options){
};

/** Insert a new entity
 * @param {Model} model
 * @param {Object|Array.<Object>} entity
 * @param {Object?} options
 * @returns {Q} -> entity
 * @throws {EntityExists}
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.insert = function(model, entity, options){
};

/** Update an existing entity
 * @param {Model} model
 * @param {Object|Array.<Object>} entity
 * @param {Object?} options
 * @returns {Q} -> entity
 * @throws {EntityNotFound}
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.update = function(model, entity, options){
};

/** Save (upsert) an entity
 * @param {Model} model
 * @param {Object|Array.<Object>} entity
 * @param {Object?} options
 * @returns {Q} -> entity
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.save = function(model, entity, options){
};

/** Remove an entity from the DB
 * @param {Model} model
 * @param {Object|Array.<Object>} entity
 * @param {Object?} options
 * @returns {Q} -> entity
 * @throws {EntityNotFound}
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.remove = function(model, entity, options){
};
