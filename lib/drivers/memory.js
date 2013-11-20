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
};

MemoryDriver.prototype.findOne = function(criteria, fields, sort, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.find = function(criteria, fields, sort, options){
    throw new Error('Not implemented');
};

MemoryDriver.prototype.count = function(criteria, options){
    throw new Error('Not implemented');
};
