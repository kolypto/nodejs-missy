'use strict';

/** In-memory driver for Missy
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

MemoryDriver.prototype.insert = function(model, entities, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.update = function(model, entities, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.save = function(model, entities, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.remove = function(model, entities, options){
    throw new Error('Not implemented');
};
