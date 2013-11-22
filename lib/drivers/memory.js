'use strict';

var _ = require('lodash'),
    errors = require('../errors')
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
    return _.findIndex(this._storage, _.pick(entity, model.options.pk.length));
};

MemoryDriver.prototype.insert = function(model, entities, options){
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

MemoryDriver.prototype.save = function(model, entities, options){
    return _.map(entities, function(entity){
        try {
            return this.insert(model, [entity], options);
        } catch(e){
            if (e instanceof errors.EntityExists)
                return this.update(model, [entity], options);
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
