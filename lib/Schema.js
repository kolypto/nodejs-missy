'use strict';

var Q = require('q'),
    _ = require('lodash'),
    SchemaSettings = require('./options').SchemaSettings,
    Model = require('./Model').Model,
    interfaces = require('./interfaces'),
    drivers = require('./drivers'),
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
 * @throws {MissyError} invalid driver
 *
 * @constructor
 */
var Schema = exports.Schema = function(driver, settings){
    var self = this;

    // Driver initialization shortcut
    if (_.isString(driver) || _.isArray(driver)){
        var driverArgs = [].concat(driver);

        // Detect driver name
        var driverName = /^[^:]+/.exec(driverArgs[0])[0];
        if (!(driverName in drivers))
            throw new errors.MissyError('Driver not registered: ' + driverName);

        // Instantiate the driver
        driver = (function(constructor, args){
            // see: http://stackoverflow.com/a/14378462/134904
            var instance = Object.create(constructor.prototype);
            var result = constructor.apply(instance, args);
            return typeof result === 'object' ? result : instance;
        })(drivers[driverName], driverArgs);
    }

    // Properties
    this.driver = driver;
    this.settings = SchemaSettings.prepare(this, settings);
    this.types = {};
    this.models = {};

    // Check the driver interface
    if (!_.isObject(driver))
        throw new errors.MissyError('The provided argument is not a driver: ' + driver);
    var missingMethods = [];
    if (!u.interfaceImplemented(interfaces.IMissyDriver.prototype, driver, missingMethods))
        throw new errors.MissyError('The driver does not implement the IMissyDriver interface: ' + missingMethods);

    if (_.difference(['client', 'connected'], _.keys(driver)).length)
        throw new errors.MissyError('The driver is missing the required attributes');

    // Driver reconnect
    this._disconnecting = false;

    this.driver.on('disconnect', function(){
        self.driver.connected = false;

        // Don't reconnect when disconnected
        if (self._disconnecting)
            return;

        // Infinite reconnection attempts
        var reconnect = function(delay){
            return Q().delay(delay)
                .then(function(){
                    return self.driver.connect();
                })
                .catch(function(){
                    return reconnect( Math.min( 1000, delay + 100 ) )
                });
        };
        reconnect(0);
    });

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

/** Connect the schema.
 * This never failes because reconnection takes place.
 * You can use the schema even when it's not connected, but querying a disconnected schema will not succeed.
 * @returns {Q} promise for success
 */
Schema.prototype.connect = function(){
    this._disconnecting = false;
    return Q.mcall(this.driver, 'connect')
        .thenResolve();
};

/** Disconnect the schema
 * @returns {Q} promise for success
 */
Schema.prototype.disconnect = function(){
    this._disconnecting = true;
    if (!this.driver.connected)
        return Q.fulfill();
    return Q.mcall(this.driver, 'disconnect')
        .thenResolve();
};

/** Get the DB client
 * @returns {*}
 * @throws {MissyDriverError} not connected
 */
Schema.prototype.getClient = function(){
    if (!this.driver.connected)
        throw new errors.MissyDriverError(this.driver, 'Not connected');
    return this.driver.client;
};
