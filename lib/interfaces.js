'use strict';

/** Interfaces
 * @fileOverview
 */

/** Model field definition
 *
 * @property {String} name
 *      Field name
 * @property {String} type
 *      The field type (String)
 * @property {Boolean?} required
 *      Whether the field is required.
 *      No model can be saved with missing required fields.
 * @property {*|function(this:Model)?} def
 *      The default value for the field.
 *      Can either be a value, or a callback bound to a model.
 *
 * Internal properties:
 * @property {IMissyTypeHandler} _typeHandler
 *      The field type handler
 * @property {Model} _model
 *      The related model
 *
 * @interface
 */
var IModelFieldDefinition = exports.IModelFieldDefinition = function(){
};



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
 * @param {IModelField} field
 *      Field definition
 * @returns {*}
 */
IMissyTypeHandler.prototype.save = function(value, field){
};



/** Abstract Driver for Missy
 * @interface
 */
var IMissyDriver = exports.IMissyDriver = function(client, settings){
};

/** Bind the driver to a schema.
 * It can define custom types here.
 * @param {Schema} schema
 */
IMissyDriver.prototype.bindSchema = function(schema){
};

/** Prepare the field definition
 * @param {Model} model
 * @param {String} name
 * @param {IModelFieldDefinition} field
 * @returns {Array?}
 * @see {Model#_prepareFieldDefinition}
 * @protected
 */
IMissyDriver.prototype._prepareFieldDefinition = function(model, name, field){
};
