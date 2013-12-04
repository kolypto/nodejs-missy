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
 *      Can either be a value, or a function bound to a model.
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
 * @property {MissyProjection?} fields
 *      Projection, if available on the query
 * @property {MissySort?} sort
 *      Sorting, if available on the query
 * @property {MissyUpdate?} update
 *      Update operations
 * @property {Object?} options
 *      Driver options
 * @property {Object?} entities
 *      The entities being handled (fetched or returned)
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
 * The driver is responsible to emit 'connect' and 'disconnect', as well as keep `client` and `connected` fields up to date.
 *
 * @param {String|function():Q} connect
 *      Connecter function that returns a new database client (promised),
 *      or a connection string that uses the default connecter function
 * @param {Object?} options
 *      Driver options
 * @param {*} options.connect
 *      Options for the default connecter (when used)
 *
 * @property {*} client
 *      The DB client
 * @property {Boolean} connected
 *      Whether the driver is currently connected
 *
 * @event {IMissyDriver#connect}
 *      DB client connected.
 * @event {IMissyDriver#disconnect}
 *      DB client disconnected.
 *
 * @interface
 * @extends {EventEmitter}
 */
var IMissyDriver = exports.IMissyDriver = function(connect, options){
};

/** Driver name (for errors)
 * @returns {String}
 */
IMissyDriver.prototype.toString = function(){
};

/** Set up the connection
 * @returns {Q} -> promise
 */
IMissyDriver.prototype.connect = function(){
};

/** Set up the connection
 * @returns {Q} -> promise
 */
IMissyDriver.prototype.disconnect = function(){
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
 * @param {Number?} [options.skip=0]
 * @param {Number?} [options.limit=0]
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

/** Insert new entities.
 * The driver is _required_ to return entities in the same order!
 * @param {Model} model
 * @param {Array.<Object>} entities
 * @param {Object?} options
 * @returns {Q} -> entities
 * @throws {EntityExists}
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.insert = function(model, entities, options){
};

/** Update (replace) existing entities.
 * The driver is _required_ to return entities in the same order!
 * @param {Model} model
 * @param {Array.<Object>} entities
 * @param {Object?} options
 * @returns {Q} -> entities
 * @throws {EntityNotFound}
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.update = function(model, entities, options){
};

/** Save (upsert) entities.
 * The driver is _required_ to return entities in the same order!
 * @param {Model} model
 * @param {Array.<Object>} entities
 * @param {Object?} options
 * @returns {Q} -> entities
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.save = function(model, entities, options){
};

/** Remove entities.
 * The driver is _required_ to return entities in the same order!
 * @param {Model} model
 * @param {Array.<Object>} entities
 * @param {Object?} options
 * @returns {Q} -> entities
 * @throws {EntityNotFound}
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.remove = function(model, entities, options){
};

/** Update query & operators.
 * @param {Model} model
 * @param {MissyCriteria} criteria
 *      Search criteria
 * @param {MissyUpdate} update
 *      Update operations
 * @param {Object?} options
 * @param {Boolean} [options.upsert=false]
 * @param {Boolean} [options.multi=false]
 * @returns {Q} -> entities
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.updateQuery = function(model, criteria, update, options){
};

/** Remove matching entities.
 * @param {Model} model
 * @param {MissyCriteria} criteria
 *      Search criteria
 * @param {Object?} options
 *      Driver-dependent options
 * @param {Boolean} [options.multi=true]
 * @returns {Q} -> entities
 * @throws {MissyDriverError}
 */
IMissyDriver.prototype.removeQuery = function(model, criteria, options){
};






/** Missy Relation interface object
 *
 * @property {Model} model
 *      Local model object
 * @property {String} prop
 *      Local property name
 * @property {Model} foreign
 *      Foreign model object
 * @property {Boolean} arrayRelation
 *      Whether the relation produces an array of entities
 *
 * @interface
 */
var IMissyRelation = exports.IMissyRelation = function(){
};

/** Load related entities using the relation.
 * @param {Array.<Object>} entities
 *      The entities to load the current relation for
 * @param {Object|MissyProjection?} fields
 *      Fields projection for the related find() query.
 * @param {Object|Array|MissySort?} sort
 *      Sort specification for the related find() query
 * @param {Object?} options
 *      Driver-specific options for the related find() query
 * @returns {Q} -> entities
 */
IMissyRelation.prototype.loadRelated = function(entities, fields, sort, options){
};

/** Save related entities using the relation.
 * @param {Array.<Object>} entities
 *      The entities to save the current relation for
 * @param {Object?} options
 *      Driver-specific options for the related save() query
 * @returns {Q} -> entities
 */
IMissyRelation.prototype.removeRelated = function(entities, options){
};

/** Remove related entities using the relation.
 * @param {Array.<Object>} entities
 *      The entities to remove the current relation from
 * @param {Object?} options
 *      Driver-specific options for the related remove() query
 * @returns {Q} -> entities
 */
IMissyRelation.prototype.removeRelated = function(entities, options){
};
