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
    throw new Error('Not implemented');
};

MemoryDriver.prototype.find = function(model, criteria, fields, sort, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.count = function(model, criteria, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.insert = function(model, entity, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.update = function(model, entity, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.save = function(model, entity, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.remove = function(model, entity, options){
    throw new Error('Not implemented');
};
