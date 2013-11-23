'use strict';

var _ = require('lodash'),
    errors = require('../errors'),
    u = require('../util')
    ;

/** In-memory driver for Missy.
 * Is fully synchronous: e.g. does not use promises
 *
 * @constructor
 * @implements {IMissyDriver}
 */
var MemoryDriver = exports.MemoryDriver = function(){
    this._storage = [];
};

MemoryDriver.prototype.bindSchema = function(schema){
    this._schema = schema;
};

MemoryDriver.prototype.findOne = function(model, criteria, fields, sort, options){
    // Find
    var entity = _.find(
        sort.entitiesSort(this._storage),
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
    return _(sort.entitiesSort(this._storage)).chain()
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
    return _.filter(this._storage, function(entity){
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
    return _.findIndex(this._storage, _.pick(entity, model.options.pk));
};

MemoryDriver.prototype.insert = function(model, entities, options){
    // NOTE: MemoryDriver does not enforce the model to have all required fields
    return _.map(entities, function(entity){
        // PK uniqueness check
        if (this._findIndexByPk(model, entity) !== -1)
            throw new errors.EntityExists(model, entity);
        // Insert
        this._storage.push(entity);
        // Return
        return entity;
    }, this);
};

MemoryDriver.prototype.update = function(model, entities, options){
    return _.map(entities, function(entity){
        // Find entity
        var index = this._findIndexByPk(model, entity);
        if (index === -1)
            throw new errors.EntityNotFound(model, entity);
        // Update
        this._storage[index] = entity;
        // Return
        return entity;
    }, this);
};

MemoryDriver.prototype.upsert = function(model, entities, options){
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
    return _.map(entities, function(entity){
        // Find entity
        var index = this._findIndexByPk(model, entity);
        if (index === -1)
            throw new errors.EntityNotFound(model, entity);
        // Remove
        entity = this._storage.splice(index, 1)[0];
        // Return
        return entity;
    }, this);
};

MemoryDriver.prototype.updateQuery = function(model, criteria, update, options){
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
    this._storage.push(entity);

    // Finish
    return [entity];
};
