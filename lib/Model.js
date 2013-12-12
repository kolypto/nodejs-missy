'use strict';

var Q = require('q'),
    events = require('events'),
    util = require('util'),
    _ = require('lodash'),
    ModelOptions = require('./options').ModelOptions,
    u = require('./util'),
    errors = require('./errors'),
    relations = require('./relations')
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
 * @property {Object.<String, IMissyRelation>} relations
 *      Model relations
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
 * @property {function(entities:undefined,      ctx: IModelContext):Q} beforeRemoveQuery
 * @property {function(entities:Array.<Object>, ctx: IModelContext):Q} afterRemoveQuery
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
    this.relations = {};

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
        'afterUpdateQuery',
        'beforeRemoveQuery',
        'afterRemoveQuery'
    ]);

    // Internal fields

    /** Presets for fancy chaining methods
     * @type {{ fields: *?, sort: *?, rel: Array?, skip: Number?, limit: Number? }}
     * @private
     */
    this._queryWith = undefined;
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
        case Boolean: field = { type: 'boolean' }; break;
        case Date: field = { type: 'date' }; break;
        case Object: field = { type: 'object' }; break;
        case Array: field = { type: 'array' }; break;
        case undefined: field = { type: 'any' }; break;

        case 'bool': field = { type: 'boolean' }; break;
        case 'int': field = { type: 'number' }; break;
        case 'float': field = { type: 'number' }; break;
    }

    // String shortcut
    if (_.isString(field))
        field = { type: field };

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

/** Wrap a Model method so it's executed only when the driver is connected
 * @param {Function} method
 * @returns {Function}
 * @protected
 */
Model._whenConnected = function(method){
    return function(){
        var model = this,
            args = arguments
            ;

        // Create a deferred which executes the method
        var d = Q.defer();

        // Throw an exception
        if (!model.schema.settings.queryWhenConnected){
            if (model.schema.driver.connected)
                d.resolve();
            else
                d.reject(new errors.MissyDriverError(model.schema.driver, 'Driver disconnected'));
        }
        // Resolve the deferred when connected
        else {
            if (model.schema.driver.connected)
                d.resolve();
            else {
                model.schema.driver.once('connect', function(){
                    d.resolve();
                });
            }
        }

        // Finish
        return d.promise.then(function(){
            return Q.fbind(method).apply(model, args);
        });
    };
};

/** Initialize a model with _queryWith
 * @returns {Model}
 * @protected
 */
Model.prototype._initQueryWith = function(){
    if (!_.isUndefined(this._queryWith))
        return this;
    // Init
    var model = Object.create(this);
    model._queryWith = {};
    return model;
};






//region Public API



//region Helpers

/** Get the DB driver from the schema
 * @returns {*}
 */
Model.prototype.getClient = function(){
    return this.schema.getClient();
};

/** Process an entity loaded from the database
 * @param {Object|Array.<Object>?} entity
 *      The loaded entity (or an array of them)
 * @returns {Q} promise for an entity (or an array of them)
 * @throws {MissyModelError} when a TypeHandler failed to convert a value
 */
Model.prototype.entityImport = function(entity){
    if (!entity)
        return Q.fulfill(entity);

    if (_.isArray(entity))
        return Q.all(_.map(entity, this.entityImport.bind(this))); // -> entities

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
        // entityPrototype
        .then(function(){
            if (self.options.entityPrototype)
                entity.__proto__ = self.options.entityPrototype;
        })
        // afterImport
        .then(function(){
            return self.hooks.afterImport(entity);
        })
        // return
        .then(function(){ return entity; });
};

/** Process an entity before insertion to the database
 * @param {Object|Array.<Object>?} entity
 *      The entity to be saved (or an array of them)
 * @returns {Q} promise for an entity (or an array of them)
 * @throws {MissyModelError} when a TypeHandler failed to convert a value
 */
Model.prototype.entityExport = function(entity){
    if (_.isArray(entity))
        return Q.all(_.map(entity, this.entityExport.bind(this))); // -> entities

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

//endregion



//region Queries

/** Get a single entity by its primary key
 * @param {*|Array|Object} pk
 *      The primary key value.
 *      In case of a compound PK, use an array or object of values.
 * @param {String|Array|Object|MissyProjection?} fields
 *      Fields projection. @see {Projection}
 * @returns {Q} promise for an entity, or `null` when not found
 * @throws {MissyModelError} invalid primary key (promised)
 */
Model.prototype.get = function(pk, fields){
    return this.findOne(
        new u.MissyCriteria.fromPk(this, pk),
        fields
    );
};
Model.prototype.get = Model._whenConnected(Model.prototype.get);

/** Get a single entity by condition.
 * When multiple entities are found, others are silently discarded.
 * @param {Object|MissyCriteria?} criteria
 *      Search criteria
 * @param {String|Object|MissyProjection?} fields
 *      Fields projection
 * @param {String|Object|Array|MissySort?} sort
 *      Sort specification
 * @param {Object?} options
 *      Driver-specific options
 * @returns {Q} promise for an entity, or `null` when not found
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.findOne = function(criteria, fields, sort, options){
    var self = this;

    // Params
    var ctx = this._initContext({
        criteria: criteria,
        fields: fields,
        sort: sort,
        options: options || {}
    });

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
        // loadRelated
        .then(self._applyQueryWith_rel('load')) // -> entity
        // afterFindOne
        .then(function(entity){
            return self.hooks.afterFindOne(entity, ctx); // -> [ entity, ctx ]
        })
        // return
        .get(0); // -> entity
};
Model.prototype.findOne = Model._whenConnected(Model.prototype.findOne);

/** Find an array of entities
 * @param {Object|MissyCriteria?} criteria
 *      Search criteria
 * @param {String|Object|MissyProjection?} fields
 *      Fields projection
 * @param {String|Object|Array|MissySort?} sort
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
Model.prototype.find = function(criteria, fields, sort, options){
    var self = this;

    // Params
    var ctx = this._initContext({
        entities: undefined,
        criteria: criteria,
        fields: fields,
        sort: sort,
        options: _.defaults(options || {}, { skip: 0, limit: 0 })
    });
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
            return self.entityImport(ctx.entities); // -> entities
        })
        // loadRelated
        .then(self._applyQueryWith_rel('load')) // -> entities
        // afterFind
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.afterFind(ctx.entities, ctx); // -> [entities, ctx]
        })
        // return
        .get(0); // -> entities
};
Model.prototype.find = Model._whenConnected(Model.prototype.find);

/** Get the number of matching entities
 * @param {Object|MissyCriteria?} criteria
 *      Search criteria
 * @param {Object?} options
 *      Driver-specific options
 * @returns {Q} promise for a number
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.count = function(criteria, options){
    var self = this;

    // Params
    var ctx = this._initContext({
        criteria: criteria,
        options: options || {}
    });

    return Q().then(function(){
        return self.schema.driver.count(self, ctx.criteria, ctx.options); // -> count
    });
};
Model.prototype.count = Model._whenConnected(Model.prototype.count);

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
Model.prototype.insert = function(entities, options){
    if (!_.isObject(entities))
        throw new errors.MissyModelError(this, 'Can only insert object or array');
    var self = this;

    // Empty
    if (_.isEmpty(entities))
        return Q.fulfill(entities);

    // Params
    var ctx = this._initContext({
        entities: [].concat(entities),
        options: options || {}
    });

    return Q()
        // entityExport
        .then(function(){
            return self.entityExport(ctx.entities); // -> entities
        })
        // beforeInsert
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.beforeInsert(ctx.entities, ctx); // -> [entities, ctx]
        })
        // insert
        .then(function(){
            return self.schema.driver.insert(self, self._withoutRelated(ctx.entities), ctx.options);
        })
        // saveRelated
        .then(function(entities){
            return self._applyQueryWith_rel('save')(ctx.entities)
                .thenResolve(entities);
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return self.entityImport(ctx.entities); // -> entities
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
};
Model.prototype.insert = Model._whenConnected(Model.prototype.insert);

/** Update (replace) an existing entity
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
Model.prototype.update = function(entities, options){
    if (!_.isObject(entities))
        throw new errors.MissyModelError(this, 'Can only update object or array');
    var self = this;

    // Empty
    if (_.isEmpty(entities))
        return Q.fulfill(entities);

    // Params
    var ctx = this._initContext({
        entities: [].concat(entities),
        options: options || {}
    });

    return Q()
        // entityExport
        .then(function(){
            return self.entityExport(ctx.entities); // -> entities
        })
        // beforeUpdate
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.beforeUpdate(ctx.entities, ctx); // -> [entities, ctx]
        })
        // update
        .then(function(){
            return self.schema.driver.update(self, self._withoutRelated(ctx.entities), ctx.options); // -> entities
        })
        // saveRelated
        .then(function(entities){
            return self._applyQueryWith_rel('save')(ctx.entities)
                .thenResolve(entities); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return self.entityImport(ctx.entities); // -> entities
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
};
Model.prototype.update = Model._whenConnected(Model.prototype.update);

/** Save (upsert) an entity
 * When an array is given - an array is returned. On error, execution stops.
 * @param {Object|Array.<Object>} entities
 *      The entity to upsert, or an array of them.
 * @param {Object?} options
 *      Driver-dependent options
 * @returns {Q} promise for an entity: the full saved entity (or an array of them)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.save = function(entities, options){
    if (!_.isObject(entities))
        throw new errors.MissyModelError(this, 'Can only upsert object or array');
    var self = this;

    // Empty
    if (_.isEmpty(entities))
        return Q.fulfill(entities);

    // Params
    var ctx = this._initContext({
        entities: [].concat(entities),
        options: options || {}
    });

    return Q()
        // entityExport
        .then(function(){
            return self.entityExport(ctx.entities); // -> entities
        })
        // beforeSave
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.beforeSave(ctx.entities, ctx); // -> [entities, ctx]
        })
        // save
        .then(function(){
            return self.schema.driver.save(self, self._withoutRelated(ctx.entities), ctx.options); // -> entities
        })
        // saveRelated
        .then(function(entities){
            return self._applyQueryWith_rel('save')(ctx.entities)
                .thenResolve(entities); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return self.entityImport(ctx.entities); // -> entities
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
};
Model.prototype.save = Model._whenConnected(Model.prototype.save);

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
Model.prototype.remove = function(entities, options){
    if (!_.isObject(entities))
        throw new errors.MissyModelError(this, 'Can only remove object or array');
    var self = this;

    // Empty
    if (_.isEmpty(entities))
        return Q.fulfill(entities);

    // Params
    var ctx = this._initContext({
        entities: [].concat(entities),
        options: options || {}
    });

    return Q()
        // Convert
        .then(function(){
            // don't do entityExport() here, as the entity can be partial
            return _.map(ctx.entities, function(entity){
                return self.converter.convertEntity('save', entity);
            });
        })
        // beforeRemove
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.beforeRemove(ctx.entities, ctx); // -> [entities, ctx]
        })
        // removeRelated
        .get(0)
        .then(self._applyQueryWith_rel('remove')) // -> entities
        // remove
        .then(function(){
            return self.schema.driver.remove(self, ctx.entities, ctx.options); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return self.entityImport(ctx.entities); // -> entities
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
};
Model.prototype.remove = Model._whenConnected(Model.prototype.remove);

/** Update DB entities using criteria and update operators.
 * This also can update multiple entities: options.multi=true
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
 * @returns {Q} promise for an entity: the full saved entity, or null when not found (or an array of them when multi=true)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.updateQuery = function(criteria, update, options){
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
        // beforeUpdateQuery
        .then(function(){
            return self.hooks.beforeUpdateQuery(ctx.entities, ctx); // -> [undefined, ctx]
        })
        // updateQuery
        .then(function(){
            return self.schema.driver.updateQuery(self, ctx.criteria, ctx.update, ctx.options); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return self.entityImport(ctx.entities); // -> entities
        })
        // afterUpdateQuery
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.afterUpdateQuery(ctx.entities, ctx); // -> [entities, ctx]
        })
        // return
        .spread(function(ret){
            return ctx.options.multi? ret : (ret[0] || null);
        });
};
Model.prototype.updateQuery = Model._whenConnected(Model.prototype.updateQuery);

/** Remove the matching DB entities using criteria.
 * @param {Object|MissyCriteria} criteria
 *      Search criteria
 * @param {Object?} options
 *      Driver-dependent options
 * @param {Boolean} [options.multi=true]
 *      Allow removing multiple entities
 * @returns {Q} promise for an entity: the full removed entity, or null when not found (or an array of them when multi=true)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.removeQuery = function(criteria, options){
    var self = this;

    // Params
    var ctx = {
        model: this,
        entities: undefined,
        criteria: new u.MissyCriteria(this, criteria),
        options: _.defaults(options || {}, { multi: true })
    };

    return Q()
        // beforeRemoveQuery
        .then(function(){
            return self.hooks.beforeRemoveQuery(ctx.entities, ctx); // -> [undefined, ctx]
        })
        // removeQuery
        .then(function(){
            return self.schema.driver.removeQuery(self, ctx.criteria, ctx.options); // -> entities
        })
        // entityImport
        .then(function(entities){
            ctx.entities = entities;
            return self.entityImport(ctx.entities); // -> entities
        })
        // afterRemoveQuery
        .then(function(entities){
            ctx.entities = entities;
            return self.hooks.afterRemoveQuery(ctx.entities, ctx); // -> [entities, ctx]
        })
        // return
        .spread(function(ret){
            return ctx.options.multi? ret : (ret[0] || null);
        });
};
Model.prototype.removeQuery = Model._whenConnected(Model.prototype.removeQuery);

//endregion



//region Relations

/** Add a generic relation to the model
 * @param {IMissyRelation} rel
 * @returns {IMissyRelation}
 */
Model.prototype.addRelation = function(rel){
    this.relations[rel.prop] = rel;
    return rel;
};

/** Define a hasOne relation to another model. Helper.
 * @see {relations.hasOne}
 *
 * @param {String} prop
 * @param {Model} foreign
 * @param {String|Array.<String>|Object} fields
 *
 * @returns {hasOne}
 */
Model.prototype.hasOne = function(prop, foreign, fields){
    return this.addRelation(
        new relations.hasOne(this, prop, foreign, fields)
    );
};

/** Define a hasMany relation to another model. Helper.
 * @see {relations.hasMany}
 *
 * @param {String} prop
 * @param {Model} foreign
 * @param {String|Array.<String>|Object} fields
 *
 * @returns {hasMany}
 */
Model.prototype.hasMany = function(prop, foreign, fields){
    return this.addRelation(
        new relations.hasMany(this, prop, foreign, fields)
    );
};

//Model.prototype.hasManyThrough = function(prop, foreign, fields){
//    return this.addRelation(
//        new relations.hasManyThrough(this, prop, foreign, fields)
//    );
//};

/** Follow the deep '.'-notation related specification
 * @param {Array.<Object>} entities
 * @param {String} prop
 * @returns {{ model: Model, relation: IMissyRelation, rows: Array.<Object> }}
 *      model: The model the relation is defined on
 *      relation: The relation to be processed
 *      rows: all entities on the named relation level (merged array of entities)
 * @throws {MissyModelError} Undefined relation
 * @protected
 */
Model.prototype._getDeepRelation = function(entities, prop){
    var self = this;

    // Deep relation
    var model = self,
        relation = undefined,
        rows = entities;

    var propsPath = prop.split('.');
    _.each(propsPath, function(p, level){
        if (!(p in model.relations))
            throw new errors.MissyModelError(model, 'Undefined relation: ' + prop + ' (stopped at '+p+')');

        // Follow the relation chain
        relation = model.relations[p];
        if (level == (propsPath.length - 1))
            return;
        model = relation.foreign;

        // Collect entities
        var newRows = [];

        if (relation.arrayRelation)
            _.each(rows, function(row){
                if (_.isArray(row[p]))
                    newRows = newRows.concat(row[p]);
            });
        else
            _.each(rows, function(row){
                if (!_.isEmpty(row[p]))
                    newRows.push(row[p]);
            });

        rows = newRows;
    });

    // Finish
    return {
        model: model,
        relation: relation,
        rows: rows
    };
};

/** Perform an action on related entities
 *
 * @see {Model#loadRelated}
 * @see {Model#saveRelated}
 * @see {Model#removeRelated}
 *
 * @param {String} act
 *      The action to perform: 'load', 'save', 'remove'
 * @param {Object|Array.<Object>} entities
 *      Entities to act on (or an array of them)
 * @param {String|Array|undefined} prop
 *      Relation name to act on, or an array of them. `undefined` to load all Model relations.
 *      Follows nested relations: User.withRelated('posts.images').find(...)
 * @param {...args}
 *      More arguments
 *
 * @returns {Q} promise for an entity (or an array of them)
 * @throws {MissyModelError} on undefined relation (promised)
 * @throws {MissyRelationError} relation errors (promised)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.doRelated = function(act, entities, prop){
    var self = this,
        args = _.toArray(arguments).slice(3)
        ;

    // all relations
    if (_.isUndefined(prop))
        prop = _.keys(self.relations);

    // array
    if (_.isArray(prop)){
        return Q.all(
            _.map(prop, function(prop){
                return self.doRelated.apply(self, [act, entities, prop].concat(args));
            })
        ).thenResolve(entities);
    }

    // Single relation
    var rel = this._getDeepRelation([].concat(entities), prop);

    return rel.relation[act + 'Related'].apply( rel.relation,
            [rel.rows].concat(args)
        ).then(function(){
            return entities;
        });
};
Model.prototype.doRelated = Model._whenConnected(Model.prototype.doRelated);

/** Load related entities
 *
 * @see {Model#doRelated}
 *
 * @param {Object|Array.<Object>} entities
 * @param {String|Array|undefined} prop
 * @param {String|Object|MissyProjection?} fields
 *      Related find() fields projection
 * @param {String|Object|Array|MissySort?} sort
 *      Related find() sort
 * @param {Object?} options
 *      Related find() options
 *
 * @returns {Q} promise for an entity (or an array of them)
 * @throws {MissyModelError} on undefined relation (promised)
 * @throws {MissyRelationError} when the projection drops foreign keys (promised)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.loadRelated = function(entities, prop, fields, sort, options){
    return this.doRelated('load', entities, prop, fields, sort, options);
};

/** Save related entities
 *
 * @see {IMissyRelation#saveRelated}
 * @see {Model#save}
 *
 * @param {Object|Array.<Object>} entities
 * @param {String|Array|undefined} prop
 * @param {Object?} options
 *      Related save() options
 *
 * @returns {Q} promise for an entity (or an array of them)
 * @throws {MissyModelError} on undefined relation (promised)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.saveRelated = function(entities, prop, options){
    return this.doRelated('save', entities, prop, options);
};

/** Remove related entities
 *
 * @see {IMissyRelation#saveRelated}
 * @see {Model#save}
 *
 * @param {Object|Array.<Object>} entities
 * @param {String|Array|undefined} prop
 * @param {Object?} options
 *      Related removeQuery() options
 *
 * @returns {Q} promise for an entity (or an array of them)
 * @throws {MissyModelError} on undefined relation (promised)
 * @throws {MissyDriverError} driver errors (promised)
 */
Model.prototype.removeRelated = function(entities, prop, options){
    return this.removeRelated('save', entities, prop, options);
};

/** Automatically process the related entities with the next query.
 * - find(), findOne(): load related entities
 * - insert(), update(), save(): save related entities (replaces them & removes the missing ones)
 * - remove(): remove related entities
 *
 * In fact, this method just stashes the arguments for loadRelated(), saveRelated(), removeRelated()
 *
 * @see {Model#loadRelated}
 * @see {Model#saveRelated}
 * @see {Model#removeRelated}
 *
 * @param {String} prop
 *
 * @returns {Model}
 */
Model.prototype.withRelated = function(prop){
    var model = this._initQueryWith();

    // Init the property
    if (!model._queryWith.rel)
        model._queryWith.rel = [];

    // Stash arguments
    model._queryWith.rel.push( _.toArray(arguments) ); // push arguments

    return model;
};

/** Process relation handling methods assigned by Model.withRelated()
 * @param {String} act
 *      Relation processing method to invoke: load, save, remove
 * @returns {function(Object|Array.<Object>):Q} -> entity | entities
 * @protected
 */
Model.prototype._applyQueryWith_rel = function(act){
    var self = this;
    return function(entities){
        // Do nothing when there's nothing to do :)
        if (!self._queryWith || !self._queryWith.rel || _.isEmpty(entities))
            return Q.fulfill(entities);

        // Call every function with the stashed arguments
        return _.map(self._queryWith.rel, function(args){
            return function(){
                return self.doRelated.apply(self, [act, entities].concat(args));
            };
        }).reduce(Q.when, Q(1))
            .thenResolve(entities); // -> entities
    };
};

/** Copy entities and remove relation properties
 * This prevents them from being saved to DB along with the entities
 * @param {Object|Array.<Object>} entities
 * @returns {Object|Array.<Object>}
 * @private
 */
Model.prototype._withoutRelated = function(entities){
    var relationNames = _.keys(this.relations);

    // Don't modify when no relations are defined on the model
    if (!relationNames.length)
        return entities;

    // Cleanse
    var processEntity = function(entity){
        return _.omit(_.clone(entity), relationNames);
    };
    if (_.isArray(entities))
        return _.map(entities, processEntity);
    else
        return processEntity(entities);
};

//endregion


//region Chaining

/** Chaining: stash the `fields` argument for the next query
 * @param {String|Object|MissyProjection?} fields
 * @returns {Model}
 */
Model.prototype.pick = function(fields){
    var model = this._initQueryWith();
    model._queryWith.fields = fields;
    return model;
};

/** Chaining: stash the `sort` argument for the next query
 * @param {String|Object|Array|MissySort?} sort
 * @returns {Model}
 */
Model.prototype.sort = function(sort){
    var model = this._initQueryWith();
    model._queryWith.sort = sort;
    return model;
};

/** Chaining: stash the `skip` option for the next query
 * @param {Number?} skip
 * @param {Number?} limit
 * @returns {Model}
 */
Model.prototype.skip = function(skip, limit){
    var model = this._initQueryWith();
    model._queryWith.skip = skip || 0;
    if (limit)
        model._queryWith.limit = limit;
    return model;
};

/** Chaining: stash the `skip` option for the next query
 * @param {Number?} limit
 * @returns {Model}
 */
Model.prototype.limit = function(limit){
    var model = this._initQueryWith();
    model._queryWith.limit = limit || 0;
    return model;
};

/** Apply the stashed arguments to a context: criteria, fields, sort, skip, limit
 * @param {IModelContext} ctx
 * @returns {IModelContext}
 * @protected
 */
Model.prototype._initContext = function(ctx){
    if (this._queryWith){
        // skip, limit
        if (ctx.options)
            _.extend(ctx.options, _.pick(this._queryWith, 'skip', 'limit'));

        // fields, sort
        _.extend(ctx, _.pick(this._queryWith, 'fields', 'sort'));
    }

    // Initialize
    if ('criteria' in ctx)   ctx.criteria    = new u.MissyCriteria(this, ctx.criteria);
    if ('fields' in ctx)     ctx.fields      = new u.MissyProjection(ctx.fields);
    if ('sort' in ctx)       ctx.sort        = new u.MissySort(ctx.sort);

    // Finish
    ctx.model = this;
    return ctx;
};

//endregion

//endregion
