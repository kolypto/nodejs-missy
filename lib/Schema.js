'use strict';

var _ = require('lodash'),
    SchemaSettings = require('./options').SchemaSettings,
    Model = require('./Model').Model,
    interfaces = require('./interfaces'),
    errors = require('./errors'),
    types = require('./types')
    ;

/** A Schema is a bridge that connects your {Model}s with the {Driver} of your choice.
 *
 * There are other service facilities:
 * - Register custom types
 *
 * @param {IMissyDriver} driver
 *      The driver to work with
 * @param {SchemaSettings} settings
 *      Global settings on the schema
 *
 * @property {IMissyDriver} driver
 *      The driver to work with
 * @property {SchemaSettings} settings
 *      Global settings on the schema
 * @property {Object.<String, IMissyTypeHandler>} types
 *      Data types defined on the schema
 * @property {Object.<String, Model>} models
 *      Models defined on this schema
 *
 * @constructor
 */
var Schema = exports.Schema = function(driver, settings){
    this.driver = driver;
    this.settings = SchemaSettings.prepare(this, settings);
    this.types = {};
    this.models = {};

    // Register standard types
    _.each(types.stdTypes, function(TypeHandler, name){
        this.registerType(name, TypeHandler);
    }, this);

    // Register the driver.
    this.driver.bindSchema(this);
};

/** Register a model on this schema
 * @param {Model} model
 * @returns {Schema}
 * @throws {MissyError} when trying to add a non-Model object
 */
Schema.prototype.registerModel = function(model){
    if (!(model instanceof Model))
        throw new error.MissyError('Expected an instance of Model');
    this.models[model.name] = model;
    return this;
};

/** Define a Model on this schema. Sugar.
 * @param {String} name
 * @param {Object} fields
 * @param {ModelOptions?} options
 * @returns {Model}
 */
Schema.prototype.define = function(name, fields, options){
    return this.registerModel(new Model(this, name, fields, options));
};

/** Register a data type in this schema
 * @param {String} name
 *      Name for the type
 * @param {IMissyTypeHandler} TypeHandler
 *      Data type class
 * @returns {Schema}
 */
Schema.prototype.registerType = function(name, TypeHandler){
    if (!(type instanceof interfaces.IMissyType))
        throw new error.MissyError('Expected an instance of Model');
    this.types[name] = new Type(this, name);
    return this;
};
