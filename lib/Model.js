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
 * @throws {MissyModelError} when a TypeHandler failed to convert a value
 */
Model.prototype.entityLoading = function(entity){
    if (!entity)
        return Q.fulfill(entity);

    // Convert
    var self = this;
    return Q()
        // beforeLoading
        .then(function(){
            return self.hooks.beforeLoading(entity);
        })
        // convertEntity
        .then(function(){
            entity = self.converter.convertEntity('load', entity);
        })
        // afterLoading
        .then(function(){
            return self.hooks.afterLoading(entity);
        })
        // return
        .then(function(){ return entity; });
};

/** Process an entity before insertion to the database
 * @param {Object?} entity
 * @returns {Q} promise for an entity
 * @throws {MissyModelError} when a TypeHandler failed to convert a value
 */
Model.prototype.entitySaving = function(entity){
    // Convert
    var self = this;
    return Q()
        // beforeSaving
        .then(function(){
            return self.hooks.beforeSaving(entity);
        })
        // convertEntity
        .then(function(){
            return self.converter.convertEntity('save', entity);
        })
        // afterSaving
        .then(function(entity){
            return self.hooks.afterSaving(entity);
        })
        // return
        .get(0);
};

/** Get a single entity by its primary key
 * @param {*|Array|Object} pk
 *      The primary key value.
 *      In case of a compound PK, use an object of values.
 * @param {Array|Object|MissyProjection?} fields
 *      Fields projection. @see {Projection}
 * @returns {Q} promise for an entity, or `null` when not found
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
 *      Driver-specific options
 * @returns {Q} promise for an entity, or `null` when not found
 * @throws {MissyDriverError} driver errors
 */
Model.prototype.findOne = function(criteria, fields, sort, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        criteria: new u.MissyCriteria(this, criteria),
        fields: new u.MissyProjection(fields),
        sort: new u.MissySort(sort),
        options: options || {}
    };

    return Q()
        // beforeFindOne
        .then(function(){
            return self.hooks.beforeFindOne(undefined, ctx); // -> [ undefined, ctx ]
        })
        // findOne
        .then(function(){
            return self.driver.findOne(self, ctx.criteria, ctx.fields, ctx.sort, ctx.options)
        })
        // entityLoading
        .then(function(entity){
            return self.entityLoading(entity);
        })
        // afterFindOne
        .then(function(entity){
            return self.hooks.afterFindOne(entity, ctx); // -> [ entity, ctx ]
        })
        // return
        .get(0);
};

/** Find an array of entities
 * @param {Object|MissyCriteria?} criteria
 * @param {Object|MissyProjection?} fields
 * @param {Object|Array|MissySort?} sort
 * @param {Object?} options
 *      Driver-specific options.
 * @returns {Q} promise for an array of entities
 * @throws {MissyDriverError} driver errors
 */
Model.prototype.find = function(criteria, fields, sort, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        criteria: new u.MissyCriteria(this, criteria),
        fields: new u.MissyProjection(fields),
        sort: new u.MissySort(sort),
        options: options || {}
    };

    return Q()
        // beforeFind
        .then(function(){
            return self.hooks.beforeFind(undefined, ctx);
        })
        // find
        .then(function(){
            return self.driver.find(self, ctx.criteria, ctx.fields, ctx.sort, ctx.options);
        })
        // entityLoading
        .then(function(entity){
            return self.entityLoading(entity);
        })
        // afterFind
        .then(function(entity){
            return self.hooks.afterFind(entity, ctx);
        })
        // return
        .get(0);
};

/** Get the number of matching entities
 * @param {Object|MissyCriteria?} criteria
 * @param {Object?} options
 *      Driver-specific options
 * @returns {Q} promise for a number
 * @throws {MissyDriverError} driver errors
 */
Model.prototype.count = function(criteria, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        criteria: new u.MissyCriteria(this, criteria),
        options: options || {}
    };

    return self.driver.count(self, ctx.criteria, ctx.options); // -> count
};

/** Insert a new entity.
 * When an array, an array is returned. On error, execution stops.
 * @param {Object|Array.<Object>} entity
 *      The entity to insert, or an array of them
 * @param {Object?} options
 *      Driver-specific options
 * @returns {Q} promise for an entity: the full inserted entity
 * @throws {EntityExists} when the entity already exists
 * @throws {MissyDriverError} driver errors
 */
Model.prototype.insert = function(entity, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        entity: entity,
        options: options || {}
    };

    return Q()
        // entitySaving
        .then(function(){
            return self.entitySaving(entity);
        })
        // beforeInsert
        .then(function(){
            return self.hooks.beforeInsert(entity, ctx);
        })
        // insert
        .then(function(){
            return self.driver.insert(self, entity, ctx.options);
        })
        // entityLoading
        .then(function(entity){
            return self.entitySaving(entity);
        })
        // afterInsert
        .then(function(entity){
            return self.hooks.afterInsert(entity, ctx);
        })
        // return
        .get(0);
};

/** Update an existing entity
 * When an array, an array is returned. On error, execution stops.
 * @param {Object|Array.<Object>} entity
 *      The entity to update, or an array of them.
 *      It must contain the primary key columns.
 * @param {Object?} options
 *      Driver-dependent options
 * @returns {Q} promise for an entity: the full updated entity
 * @throws {EntityNotFound} when the entity does not exist
 * @throws {MissyDriverError} driver errors
 */
Model.prototype.update = function(entity, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        entity: entity,
        options: options || {}
    };

    return Q()
        // entitySaving
        .then(function(){
            return self.entitySaving(entity);
        })
        // beforeUpdate
        .then(function(){
            return self.hooks.beforeUpdate(entity, ctx);
        })
        // update
        .then(function(){
            return self.driver.update(self, entity, ctx.options);
        })
        // entityLoading
        .then(function(entity){
            return self.entityLoading(entity);
        })
        // afterUpdate
        .then(function(entity){
            return self.hooks.afterUpdate(entity, ctx);
        })
        // return
        .get(0);
};

/** Save (upsert) an entity
 * When an array, an array is returned. On error, execution stops.
 * @param {Object|Array.<Object>} entity
 *      The entity to save, or an array of them
 * @param {Object?} options
 *      Driver-dependent options
 * @returns {Q} promise for an entity: the full saved entity
 * @throws {MissyDriverError} driver errors
 */
Model.prototype.save = function(entity, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        entity: entity,
        options: options || {}
    };

    return Q()
        // entitySaving
        .then(function(){
            return self.entitySaving(entity);
        })
        // beforeSave
        .then(function(){
            return self.hooks.beforeSave(entity, ctx);
        })
        // save
        .then(function(){
            return self.driver.save(self, entity, ctx.options);
        })
        // entityLoading
        .then(function(entity){
            return self.entityLoading(entity);
        })
        // afterSave
        .then(function(entity){
            return self.hooks.afterSave(entity, ctx);
        })
        // return
        .get(0);
};

/** Remove an entity from the DB
 * When an array, an array is returned. On error, execution stops.
 * @param {Object|Array.<Object>} entity
 *      The entity to remove, or an array of them.
 *      It must contain the primary key
 * @param {Object?} options
 *      Driver-dependent options
 * @returns {Q} promise for an entity: the full removed entity
 * @throws {EntityNotFound} when the entity does not exist
 * @throws {MissyDriverError} driver errors
 */
Model.prototype.remove = function(entity, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        entity: entity,
        options: options || {}
    };

    return Q()
        // entitySaving
        .then(function(){
            return self.entitySaving(entity);
        })
        // beforeRemove
        .then(function(){
            return self.hooks.beforeRemove(entity, ctx);
        })
        // remove
        .then(function(){
            return self.driver.remove(self, entity, ctx.options);
        })
        // entityLoading
        .then(function(entity){
            return self.entityLoading(entity);
        })
        // afterRemove
        .then(function(entity){
            return self.hooks.afterRemove(entity, ctx);
        })
        // return
        .get(0);
};

// TODO: update query ?
// TODO: upsert query ?


//endregion
