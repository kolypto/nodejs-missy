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
 * @property {function(entity:Object):Q} beforeImport
 * @property {function(entity:Object):Q} afterImport
 * @property {function(entity:Object):Q} beforeExport
 * @property {function(entity:Object):Q} afterExport
 * @property {function(entity:undefined,        ctx: IModelContext):Q} beforeFindOne
 * @property {function(entity:Object,           ctx: IModelContext):Q} afterFindOne
 * @property {function(entities:undefined,      ctx: IModelContext):Q} beforeFind
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} afterFind
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} beforeInsert
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} afterInsert
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} beforeUpdate
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} afterUpdate
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} beforeSave
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} afterSave
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} beforeRemove
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} afterRemove
 * @property {function(entities:undefined,      ctx: IModelContext):Q} beforeUpdateQuery
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} afterUpdateQuery
 *
 * @constructor
 * @throws {MissyModelError} inconsistent options
 */
var Model = exports.Model = function(schema, name, fields, options){
    this.schema = schema;
    this.name = name;

    // Prepare fields
    this.options = ModelOptions.prepare(this, options);
    this.fields = _.compose(_.object, _.compact, _.map)(fields, this._prepareFieldDefinition, this);

    // Check
    if (_.difference(this.options.pk, Object.keys(this.fields)).length !== 0)
        throw new errors.MissyModelError(this, 'PK contains undefined fields');

    // Tools
    this.converter = new u.Converter(this);
    this.hooks = new u.MissyHooks([
        'beforeImport',
        'afterImport',
        'beforeExport',
        'afterExport',
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
        'afterRemove',
        'beforeUpdateQuery',
        'afterUpdateQuery'
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
Model.prototype.entityImport = function(entity){
    if (!entity)
        return Q.fulfill(entity);

    // Convert
    var self = this;
    return Q()
        // beforeImport
        .then(function(){
            return self.hooks.beforeImport(entity);
        })
        // convertEntity
        .then(function(){
            entity = self.converter.convertEntity('load', entity);
        })
        // afterImport
        .then(function(){
            return self.hooks.afterImport(entity);
        })
        // return
        .then(function(){ return entity; });
};

/** Process an entity before insertion to the database
 * @param {Object?} entity
 * @returns {Q} promise for an entity
 * @throws {MissyModelError} when a TypeHandler failed to convert a value
 */
Model.prototype.entityExport = function(entity){
    // Convert
    var self = this;
    return Q()
        // beforeExport
        .then(function(){
            return self.hooks.beforeExport(entity);
        })
        // convertEntity
        .then(function(){
            return self.converter.convertEntity('save', entity);
        })
        // afterExport
        .then(function(entity){
            return self.hooks.afterExport(entity);
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
 * @throws {MissyModelError} invalid primary key (promised)
 */
Model.prototype.get = Q.fbind(function(pk, fields){
    return this.findOne(
        new u.MissyCriteria.fromPk(this, pk),
        fields
    );
});

/** Get a single entity by condition.
 * When multiple entities are found, others are silently discarded.
 * @param {Object|MissyCriteria?} criteria
 *      Search criteria
 * @param {Object|MissyProjection?} fields
 *      Fields projection
 * @param {Object|Array|MissySort?} sort
 *      Sort specification
 * @param {Object?} options
 *      Driver-specific options
 * @returns {Q} promise for an entity, or `null` when not found
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.findOne = Q.fbind(function(criteria, fields, sort, options){
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
            return self.schema.driver.findOne(self, ctx.criteria, ctx.fields, ctx.sort, ctx.options); // -> entity
        })
        // entityImport
        .then(function(entity){
            return self.entityImport(entity); // -> entity
        })
        // afterFindOne
        .then(function(entity){
            return self.hooks.afterFindOne(entity, ctx); // -> [ entity, ctx ]
        })
        // return
        .get(0); // -> entity
});

/** Find an array of entities
 * @param {Object|MissyCriteria?} criteria
 *      Search criteria
 * @param {Object|MissyProjection?} fields
 *      Fields projection
 * @param {Object|Array|MissySort?} sort
 *      Sort specification
 * @param {Object?} options
 *      Driver-specific options.
 * @param {Number} [options.skip=0]
 *      Skip this number of rows. 0 = no skip.
 *      Any non-number is converted to a number.
 * @param {Number} [options.limit=0]
 *      Limit to this number of rows. 0 = no limit.
 *      Any non-number is converted to a number.
 * @returns {Q} promise for an array of entities
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.find = Q.fbind(function(criteria, fields, sort, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        entities: undefined,
        criteria: new u.MissyCriteria(this, criteria),
        fields: new u.MissyProjection(fields),
        sort: new u.MissySort(sort),
        options: _.defaults(options || {}, { skip: 0, limit: 0 })
    };
    ctx.options.skip = Math.max( parseInt(ctx.options.skip) || 0, 0);
    ctx.options.limit = Math.max( parseInt(ctx.options.limit) || 0, 0);


    return Q()
        // beforeFind
        .then(function(){
            return self.hooks.beforeFind(undefined, ctx); // -> [undefined, ctx]
        })
        // find
        .then(function(){
            return self.schema.driver.find(self, ctx.criteria, ctx.fields, ctx.sort, ctx.options); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return Q.all(_.map(ctx.entities, self.entityImport.bind(self))); // -> entities
        })
        // afterFind
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.afterFind(ctx.entities, ctx); // -> [entities, ctx]
        })
        // return
        .get(0); // -> entities
});

/** Get the number of matching entities
 * @param {Object|MissyCriteria?} criteria
 *      Search criteria
 * @param {Object?} options
 *      Driver-specific options
 * @returns {Q} promise for a number
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.count = Q.fbind(function(criteria, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        criteria: new u.MissyCriteria(this, criteria),
        options: options || {}
    };

    return Q().then(function(){
        return self.schema.driver.count(self, ctx.criteria, ctx.options); // -> count
    });
});

/** Insert a new entity.
 * When an array is given - an array is returned. On error, execution stops.
 * @param {Object|Array.<Object>} entities
 *      The entity to insert, or an array of them.
 * @param {Object?} options
 *      Driver-specific options
 * @returns {Q} promise for an entity: the full inserted entity (or an array of them)
 * @throws {EntityExists} when the entity already exists (promised)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.insert = Q.fbind(function(entities, options){
    if (!_.isObject(entities))
        throw new errors.MissyModelError(this, 'Can only insert object or array');
    var self = this;

    // Params
    var ctx = {
        model: this,
        entities: [].concat(entities),
        options: options || {}
    };

    return Q()
        // entityExport
        .then(function(){
            return Q.all(_.map(ctx.entities, self.entityExport.bind(self))); // -> entities
        })
        // beforeInsert
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.beforeInsert(ctx.entities, ctx); // -> [entities, ctx]
        })
        // insert
        .then(function(){
            return self.schema.driver.insert(self, ctx.entities, ctx.options); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return Q.all(_.map(ctx.entities, self.entityImport.bind(self))); // -> entities
        })
        // afterInsert
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.afterInsert(ctx.entities, ctx); // -> [entities, ctx]
        })
        // Return
        .spread(function(ret){
            return _.isArray(entities)? ret : ret[0]; // -> entities || entity
        });
});

/** Update an existing entity
 * When an array is given - an array is returned. On error, execution stops.
 * @param {Object|Array.<Object>} entities
 *      The entity to update, or an array of them.
 *      It must contain the primary key columns.
 * @param {Object?} options
 *      Driver-dependent options
 * @returns {Q} promise for an entity: the full updated entity (or an array of them)
 * @throws {EntityNotFound} when the entity does not exist (promised)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.update = Q.fbind(function(entities, options){
    if (!_.isObject(entities))
        throw new errors.MissyModelError(this, 'Can only update object or array');
    var self = this;

    // Params
    var ctx = {
        model: this,
        entities: [].concat(entities),
        options: options || {}
    };

    return Q()
        // entityExport
        .then(function(){
            return Q.all(_.map(ctx.entities, self.entityExport.bind(self))); // -> entities
        })
        // beforeUpdate
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.beforeUpdate(ctx.entities, ctx); // -> [entities, ctx]
        })
        // update
        .then(function(){
            return self.schema.driver.update(self, ctx.entities, ctx.options); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return Q.all(_.map(ctx.entities, self.entityImport.bind(self))); // -> entities
        })
        // afterUpdate
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.afterUpdate(ctx.entities, ctx); // -> [entities, ctx]
        })
        // Return
        .spread(function(ret){
            return _.isArray(entities)? ret : ret[0]; // -> entities || entity
        });
});

/** Save (upsert) an entity
 * When an array is given - an array is returned. On error, execution stops.
 * @param {Object|Array.<Object>} entities
 *      The entity to upsert, or an array of them.
 * @param {Object?} options
 *      Driver-dependent options
 * @returns {Q} promise for an entity: the full saved entity (or an array of them)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.save = Q.fbind(function(entities, options){
    if (!_.isObject(entities))
        throw new errors.MissyModelError(this, 'Can only upsert object or array');
    var self = this;

    // Params
    var ctx = {
        model: this,
        entities: [].concat(entities),
        options: options || {}
    };

    return Q()
        // entityExport
        .then(function(){
            return Q.all(_.map(ctx.entities, self.entityExport.bind(self)));
        })
        // beforeSave
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.beforeSave(ctx.entities, ctx); // -> [entities, ctx]
        })
        // upsert
        .then(function(){
            return self.schema.driver.save(self, ctx.entities, ctx.options); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return Q.all(_.map(ctx.entities, self.entityImport.bind(self))); // -> entities
        })
        // afterSave
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.afterSave(ctx.entities, ctx); // -> [entities, ctx]
        })
        // Return
        .spread(function(ret){
            return _.isArray(entities)? ret : ret[0]; // -> entities || entity
        });
});

/** Remove an entity from the DB
 * When an array is given - an array is returned. On error, execution stops.
 * @param {Object|Array.<Object>} entities
 *      The entity to remove, or an array of them.
 *      It must contain the primary key
 * @param {Object?} options
 *      Driver-dependent options
 * @returns {Q} promise for an entity: the full removed entity (or an array of them)
 * @throws {EntityNotFound} when the entity does not exist (promised)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.remove = Q.fbind(function(entities, options){
    if (!_.isObject(entities))
        throw new errors.MissyModelError(this, 'Can only remove object or array');
    var self = this;

    // Params
    var ctx = {
        model: this,
        entities: [].concat(entities),
        options: options || {}
    };

    return Q()
        // entityExport
        .then(function(){
            return Q.all(_.map(ctx.entities, self.entityExport.bind(self))); // -> entities
        })
        // beforeRemove
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.beforeRemove(ctx.entities, ctx); // -> [entities, ctx]
        })
        // remove
        .then(function(){
            return self.schema.driver.remove(self, ctx.entities, ctx.options); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return Q.all(_.map(ctx.entities, self.entityImport.bind(self))); // -> entities
        })
        // afterRemove
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.afterRemove(ctx.entities, ctx); // -> [entities, ctx]
        })
        // Return
        .spread(function(ret){
            return _.isArray(entities)? ret : ret[0]; // -> entities || entity
        });
});

/** Update a DB entity using criteria and update operators
 * @param {Object|MissyCriteria} criteria
 *      Search criteria
 * @param {Object|MissyUpdate} update
 *      Update operations
 * @param {Object?} options
 *      Driver-dependent options
 * @param {Boolean} [options.upsert=false]
 *      Whether to make an upsert, not just update.
 *      With upsert, if an entity is missing in a database, a new one is inserted.
 *      The new entity is build from merged search criteria and update operations.
 * @param {Boolean} [options.multi=false]
 *      Allow updating multiple entities.
 * @returns {Q} promise for an entity: the full saved entity (or an array of them)
 * @throws {MissyDriverError} driver errors (promised)
 * @throws {EntityNotFound} when the entity does not exist (not in upsert mode) (promised)
 */
Model.prototype.updateQuery = Q.fbind(function(criteria, update, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        entities: undefined,
        criteria: new u.MissyCriteria(this, criteria),
        update: new u.MissyUpdate(this, update),
        options: _.defaults(options || {}, { upsert: false, multi: false })
    };

    return Q()
        // beforeQueryUpdate
        .then(function(){
            return self.hooks.beforeUpdateQuery(ctx.entities, ctx); // -> [undefined, ctx]
        })
        // update
        .then(function(){
            return self.schema.driver.updateQuery(self, ctx.criteria, ctx.update, ctx.options); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return Q.all(_.map(ctx.entities, self.entityImport.bind(self))); // -> entities
        })
        // afterQueryUpdate
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.afterUpdateQuery(ctx.entities, ctx); // -> [entities, ctx]
        })
        // return
        .spread(function(ret){
            return ctx.options.multi? ret : ret[0];
        })
});

//endregion
