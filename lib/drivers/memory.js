'use strict';

var _ = require('lodash'),
    errors = require('../errors'),
    u = require('../util'),
    Q = require('q'),
    events = require('events'),
    util = require('util')
    ;

/** In-memory driver for Missy.
 * Is fully synchronous: e.g. does not use promises directly.
 *
 * This driver always does sequential scans and is very very slow.
 * Is designed for use in unit-tests only.
 *
 * @constructor
 * @implements {IMissyDriver}
 * @extends {EventEmitter}
 */
var MemoryDriver = exports.MemoryDriver = function(connect, options){
    options = options || {};

    // Driver initialization shortcut
    if (!_.isFunction(connect)){
        connect = function(){ return Q.fulfill(); };
    }

    // Prepare
    this._storage = {};
    this._connect = connect;
    this.schema = undefined; // see: MemoryDriver.bindSchema()

    this.client = undefined; // no client
    this.connected = false;
};
util.inherits(MemoryDriver, events.EventEmitter);

MemoryDriver.prototype.toString = function(){
    return 'memory';
};

MemoryDriver.prototype.connect = function(){
    var self = this;
    return Q()
        .then(function(){
            self.connected = true;
            self.emit('connect');
        });
};

MemoryDriver.prototype.disconnect = function(){
    var self = this;
    return Q()
        .then(function(){
            self.emit('disconnect');
            self.connected = false;
    });
};

/** Ensure the table exists in the internal storage
 * @param {Model} model
 * @returns {Array} storage for the table
 * @protected
 */
MemoryDriver.prototype.getTable = function(model){
    if (!(model.options.table in this._storage))
        this._storage[model.options.table] = [];
    return this._storage[model.options.table];
};

MemoryDriver.prototype.bindSchema = function(schema){
    this._schema = schema;
};

//region Queries

MemoryDriver.prototype.findOne = function(model, criteria, fields, sort, options){
    var table = this.getTable(model);

    // Find
    var entity = _.find(
        sort.entitiesSort(table),
        function(entity){
            return criteria.entityMatch(entity);
        }
    );
    // Null
    if (_.isUndefined(entity))
        return null;
    // Projection
    return fields.entityApply(model, entity);
};

MemoryDriver.prototype.find = function(model, criteria, fields, sort, options){
    var table = this.getTable(model);

    return _(sort.entitiesSort(table)).chain()
        .filter(function(entity){
            return criteria.entityMatch(entity);
        })
        .map(function(entity){
            return fields.entityApply(model, entity);
        })
        .slice(options.skip, options.limit? options.skip + options.limit : undefined)
        .value();
};

MemoryDriver.prototype.count = function(model, criteria, options){
    var table = this.getTable(model);

    return _.filter(table, function(entity){
        return criteria.entityMatch(entity);
    }).length;
};

/** Find an entity row index by PK
 * @param {Model} model
 * @param {Object} entity
 * @returns {Number}
 * @private
 */
MemoryDriver.prototype._findIndexByPk = function(model, entity){
    var table = this.getTable(model);

    return _.findIndex(table, _.pick(entity, model.options.pk));
};

MemoryDriver.prototype.insert = function(model, entities, options){
    var table = this.getTable(model);

    // NOTE: MemoryDriver does not enforce the model to have all required fields
    return _.map(entities, function(entity){
        // PK uniqueness check
        if (this._findIndexByPk(model, entity) !== -1)
            throw new errors.EntityExists(model, entity);
        // Insert
        table.push(entity);
        // Return
        return entity;
    }, this);
};

MemoryDriver.prototype.update = function(model, entities, options){
    var table = this.getTable(model);

    return _.map(entities, function(entity){
        // Find entity
        var index = this._findIndexByPk(model, entity);
        if (index === -1)
            throw new errors.EntityNotFound(model, entity);
        // Update
        table[index] = entity;
        // Return
        return entity;
    }, this);
};

MemoryDriver.prototype.save = function(model, entities, options){
    return _.map(entities, function(entity){
        try {
            return this.insert(model, [entity], options)[0];
        } catch(e){
            if (e instanceof errors.EntityExists)
                return this.update(model, [entity], options)[0];
            else
                throw e;
        }
    }, this);
};

MemoryDriver.prototype.remove = function(model, entities, options){
    var table = this.getTable(model);

    return _.map(entities, function(entity){
        // Find entity
        var index = this._findIndexByPk(model, entity);
        if (index === -1)
            throw new errors.EntityNotFound(model, entity);
        // Remove
        entity = table.splice(index, 1)[0];
        // Return
        return entity;
    }, this);
};

MemoryDriver.prototype.updateQuery = function(model, criteria, update, options){
    var table = this.getTable(model);

    // Update
    var entities = _.map(
        this.find(model, criteria, new u.MissyProjection(), new u.MissySort(), { skip: 0, limit: options.multi? 0 : 1 }),
        function(entity){
            update.entityUpdate(entity);
            return entity;
        }
    );

    // Finish
    if (entities.length)
        return entities;

    // Error?
    var entity = update.entityInsert(criteria);
    if (!options.upsert)
        throw new errors.EntityNotFound(model, entity);
    table.push(entity);

    // Finish
    return [entity];
};

MemoryDriver.prototype.removeQuery = function(model, criteria, options){
    var table = this.getTable(model);

    return _.remove(table, function(entity){
        return criteria.entityMatch(entity);
    });
};

//endregion
