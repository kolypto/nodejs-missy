'use strict';

var _ = require('lodash'),
    SchemaSettings = require('./options').SchemaSettings,
    Model = require('./Model').Model,
    interfaces = require('./interfaces'),
    errors = require('./errors'),
    types = require('./types'),
    u = require('./util')
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

    // Check the driver interface
    if (!u.interfaceImplemented(interfaces.IMissyDriver.prototype, driver))
        throw new errors.MissyError('The driver does not implement the IMissyDriver interface');

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
        throw new errors.MissyError('Expected an instance of Model');
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
    var model = new Model(this, name, fields, options);
    this.registerModel(model);
    return model;
};

/** Register a data type in this schema
 * @param {String} name
 *      Name for the type
 * @param {IMissyTypeHandler} TypeHandler
 *      Data type class
 * @returns {Schema}
 */
Schema.prototype.registerType = function(name, TypeHandler){
    // Check interface
    if (!_.isFunction(TypeHandler))
        throw new errors.MissyError('Type handler for "'+name+'" is not a function');
    // Register
    this.types[name] = new TypeHandler(this, name);
    // Check interface
    if (!u.interfaceImplemented(interfaces.IMissyTypeHandler.prototype, this.types[name]))
        throw new errors.MissyError('Type handler for "'+name+'" does not implement the IMissyTypeHandler interface');
    return this;
};
