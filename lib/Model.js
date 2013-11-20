'use strict';

var Q = require('q'),
    events = require('events'),
    util = require('util'),
    _ = require('lodash'),
    ModelOptions = require('./options').ModelOptions,
    u = require('./util'),
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
 *      Associated schema
 * @property {String} name
 *      Model name
 * @property {Object.<String, IModelFieldDefinition>} fields
 *      Model fields definition
 * @property {ModelOptions} options
 *      Model options
 * @property {Converter} converter
 *      Model values converter
 *
 * @property {MissyHooks} hooks
 *      Hooks system on the model
 *      The following hooks are available:
 * @property {function(entity:Object):Q} beforeLoading
 * @property {function(entity:Object):Q} afterLoading
 * @property {function(entity:Object):Q} beforeSaving
 * @property {function(entity:Object):Q} afterSaving
 * @property {function(entity: undefined, ctx: IModelContext):Q} beforeFindOne
 * @property {function(entity:Object, ctx: IModelContext):Q} afterFindOne
 * @property {function(entities: undefined, ctx: IModelContext):Q} beforeFind
 * @property {function(entities:Array, ctx: IModelContext):Q} afterFind
 * @property {function(entity:Object, ctx: IModelContext):Q} beforeInsert
 * @property {function(entity:Object, ctx: IModelContext):Q} afterInsert
 * @property {function(entity:Object, ctx: IModelContext):Q} beforeUpdate
 * @property {function(entity:Object, ctx: IModelContext):Q} afterUpdate
 * @property {function(entity:Object, ctx: IModelContext):Q} beforeSave
 * @property {function(entity:Object, ctx: IModelContext):Q} afterSave
 * @property {function(entity:Object, ctx: IModelContext):Q} beforeRemove
 * @property {function(entity:Object, ctx: IModelContext):Q} afterRemove
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
    this.converter = new u.Converter(this);
    this.hooks = new u.MissyHooks([
        'beforeLoading',
        'afterLoading',
        'beforeSaving',
        'afterSaving',
        'beforeFindOne',
        'afterFindOne',
        'beforeFind',
        'afterFind',
        'beforeInsert',
        'afterInsert',
        'beforeUpdate',
        'afterUpdate',
        'beforeSave',
        'afterSave',
        'beforeRemove',
        'afterRemove'
    ]);
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
 * @returns {Q} promise for an entity
 */
Model.prototype.entityLoading = function(entity){
    if (!entity)
        return Q.fulfill(entity);

    // Convert
    var self = this;
    return Q()
        .then(function(){
            return self.hooks.beforeLoading(entity);
        })
        .then(function(){
            entity = self.converter.convertEntity('load', entity);
        })
        .then(function(){
            return self.hooks.afterLoading(entity);
        })
        .then(function(){ return entity; });
};

/** Process an entity before insertion to the database
 * @param {Object?} entity
 * @returns {Q} promise for an entity
 */
Model.prototype.entitySaving = function(entity){
    // Convert
    var self = this;
    return Q()
        .then(function(){
            return self.hooks.beforeSaving(entity);
        })
        .then(function(){
            entity = self.converter.convertEntity('save', entity);
        })
        .then(function(){
            return self.hooks.afterSaving(entity);
        })
        .then(function(){ return entity; });
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
        new u.MissyCriteria.fromPk(this, pk),
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
    var self = this;

    // Params
    var ctx = {
        criteria: new u.MissyCriteria(this, criteria),
        fields: new u.MissyProjection(fields),
        sort: new u.MissySort(sort),
        options: options || {}
    };
    this.hooks.beforeFindOne(undefined, ctx);

    // Driver
    return this.driver.findOne(ctx.criteria, ctx.fields, ctx.sort, ctx.options)
        .then(function(entity){
            entity = self.entityLoading(entity);
            self.hooks.afterFindOne(entity, ctx);
            return entity;
        });
    // TODO: eager-load
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
    var ctx = {
        criteria: new u.MissyCriteria(this, criteria),
        fields: new u.MissyProjection(fields),
        sort: new u.MissySort(sort),
        options: options || {}
    };
    this.hooks.beforeFind(undefined, ctx);

    // Driver
    return this.driver.find(ctx.criteria, ctx.fields, ctx.sort, ctx.options)
        .then(function(entities){
            entities = _.map(entities, function(entity){
                return self.entityLoading(entity);
            });
            self.hooks.afterFind(entities, ctx);
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
    criteria = new u.MissyCriteria(this, criteria);

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
