'use strict';

var Q = require('q'),
    events = require('events'),
    util = require('util'),
    _ = require('lodash'),
    ModelOptions = require('./options').ModelOptions,
    utilModel = require('./util').model,
    errors = require('./errors')
    ;

/** Model
 *
 * @param {Schema} schema
 *      The parent schema
 * @param {String} name
 *      Model name
 * @param {Object.<String, IModelFieldDefinition>} fields
 *      Model fields' definitions
 * @param {ModelOptions} options
 *      Model options
 *
 * @property {Schema} schema
 * @property {String} name
 * @property {Object.<String, IModelFieldDefinition>} fields
 * @property {ModelOptions} options
 * @property {Converter} converter
 *
 * @constructor
 */
var Model = exports.Model = function(schema, name, fields, options){
    this.schema = schema;
    this.name = name;

    // Prepare fields
    this.options = ModelOptions.prepare(this, options);
    this.fields = _.compose(_.object, _.compact, _.map)(fields, this._prepareFieldDefinition, this);

    // Tools
    this.converter = new utilModel.Converter(this);
};
util.inherits(Model, events.EventEmitter);

/** Prepare the fields definition
 * @param {String} name
 * @param {IModelFieldDefinition} field
 * @returns {Array?} [name, field] or `undefined` to skip it
 * @throws {MissyModelError} When the definition is incorrect (missing `type` property)
 * @throws {MissyModelError} When the requested `type` is not defined
 * @protected
 */
Model.prototype._prepareFieldDefinition = function(field, name){
    // Shortcut types
    switch(field){
        case String: field = { type: 'string' }; break;
        case Number: field = { type: 'number' }; break;
        case Date: field = { type: 'date' }; break;
        case Object: field = { type: 'object' }; break;
        case Array: field = { type: 'array' }; break;
        case undefined: field = { type: 'any' }; break;
    }

    // Still ok?
    if (name === undefined || field === undefined)
        return undefined; // skip field

    // Validation
    if (field.type === undefined)
        throw new errors.MissyModelError(this, 'Incorrect definition given for field `'+ name +'`');

    // `type`, `_typeHandler`: Pick the type handler
    if (field._typeHandler === undefined){ // the driver might have already set it
        var type = this.schema.types[field.type];
        if (type === undefined)
            throw new errors.MissyModelError(this, 'Undefined type "'+field.type+'" for field `'+ name +'`');
        field._typeHandler = this.schema.types[field.type];
    }

    // Default values
    _.defaults(field, {
        name: name,
        required: this.options.required || false,
        _model: this
    });

    return [name, field];
};



//region Public API

/** Process an entity loaded from the database
 * @param {Object?} entity
 * @returns {Object?}
 */
Model.prototype.entityLoading = function(entity){
    if (!entity)
        return entity;

    // Convert
    entity = this.converter.convertEntity('load', entity);

    // Finish
    return entity;
};

/** Process an entity before insertion to the database
 * @param {Object?} entity
 * @returns {Object?}
 */
Model.prototype.entitySaving = function(entity){
    return this.converter.convertEntity('save', entity);
};

/** Get a single entity by its primary key
 * @param {*|Array|Object} pk
 *      The primary key value.
 *      In case of a compound PK, use an object of values.
 * @param {Array|Object|MissyProjection?} fields
 *      Fields projection. @see {Projection}
 * @returns {Q} promise for an entity, or NULL when not found
 * @throws {MissyModelError} invalid primary key
 */
Model.prototype.get = function(pk, fields){
    return this.findOne(
        new utilModel.MissyCriteria.fromPk(this, pk),
        fields
    );
};

/** Get a single entity by condition
 * @param {Object|MissyCriteria?} criteria
 * @param {Object|MissyProjection?} fields
 * @param {Object|Array|MissySort?} sort
 * @param {Object?} options
 *      Driver-dependent options
 * @returns {Q}
 */
Model.prototype.findOne = function(criteria, fields, sort, options){
    // Params
    criteria = new utilModel.MissyCriteria(this, criteria);
    fields = new utilModel.MissyProjection(fields);
    sort = new utilModel.MissySort(sort);

    // Driver
    return this.driver.findOne(criteria, fields, sort, options || {})
        .then(this.entityLoaded.bind(this));
    // TODO: eager-load
    // TODO: events
};

/** Get an array of entities by condition
 * @param {Object|MissyCriteria?} criteria
 * @param {Object|MissyProjection?} fields
 * @param {Object|Array|MissySort?} sort
 * @param {Object?} options
 *      Driver-dependent options.
 * @returns {Q}
 */
Model.prototype.find = function(criteria, fields, sort, options){
    var self = this;

    // Params
    criteria = new utilModel.MissyCriteria(this, criteria);
    fields = new utilModel.MissyProjection(fields);
    sort = new utilModel.MissySort(sort);

    // Driver
    return this.driver.find(criteria, fields, sort, options || {})
        .then(function(entities){
            return _.map(entities, self.entityLoaded, self);
        });
    // TODO: eager-load
    // TODO: events
};

/** Get the number of entities that match a query
 * @param {Object|MissyCriteria?} criteria
 * @param {Object?} options
 *      Driver-dependent options
 * @returns {Q}
 */
Model.prototype.count = function(criteria, options){
    // Params
    criteria = new utilModel.MissyCriteria(this, criteria);

    // Delegate the search to the driver
    return this.driver.count(criteria, options || {});
    // TODO: events
};

Model.prototype.insert = function(entity, options){
    // TODO: insert()
    // TODO: events
    // TODO: save related?
};

Model.prototype.update = function(entity, options){
    // TODO: update()
    // TODO: events
    // TODO: update related?
};

Model.prototype.save = function(entity, options){
    // TODO: save()
    // TODO: events
    // TODO: save related?
};

Model.prototype.remove = function(entity, options){
    // TODO: remove()
    // TODO: events
};

// TODO: update query ?
// TODO: upsert query ?


//endregion
