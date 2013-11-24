'use strict';

/** Missy Model relations
 * @fileOverview
 */

var Q = require('q'),
    util = require('util'),
    _ = require('lodash')
    ;



/** Relation interface object
 *
 * @property {Model} model
 * @property {String} prop
 * @property {Model} foreign
 *
 * @interface
 */
var IRelation = exports.IRelation = function(){
};

/** Load related entities using the relation.
 * @param {Array.<Object>} entities
 *      The entities to load the current relation for
 * @param {Object|MissyProjection?} fields
 *      Fields projection for the related find() query.
 *      NOTE: never, never exclude the relation fields!
 * @param {Object|Array|MissySort?} sort
 *      Sort specification for the related find() query
 * @param {Object?} options
 *      Driver-specific options for the related find() query
 * @returns {Q} promise for {Array.<Object>}
 */
IRelation.prototype.loadRelated = function(entities, fields, sort, options){
};






/** "Has one": this model references a foreign one through common fields
 * @param {Model} model
 *      The current model
 * @param {String} prop
 *      The property name to store the related entities to
 * @param {Model} foreign
 *      The foreign model
 * @param {String|Array.<String>|Object} fields
 *      Fields that define the relation.
 *      | String:   a common field name
 *      | Array:    multiple common field names
 *      | Object:   local field names mapped to foreign field names
 * @constructor
 * @implements {IRelation}
 */
var hasOne = exports.hasOne = function(model, prop, foreign, fields){
    this.model = model;
    this.prop = prop;
    this.foreign = foreign;
    this.fields = hasOne._prepareFields(fields);

    if (this.fields.length >= 1)
        throw new Error('Missy relations don\'t yet support multi-column relations');
};

/** Normalize the `fields` into an object
 * @param {String|Array.<String>|Object} fields
 * @returns {Object.<String,String>}
 * @protected
 */
hasOne._prepareFields = function(fields){
    // Array
    if (_.isArray(fields))
        return _.zipObject(fields, fields);
    // Object
    else if (_.isObject(fields))
        return fields;
    // String
    else
        return _.object([[fields, fields]]);
};

hasOne.prototype.loadRelated = Q.fbind(function(entities, fields, sort, options){
    var self = this;

    // For hasMany, prepare array properties
    if (self instanceof hasMany)
        _.each(entities, function(entity){
            entity[self.prop] = [];
        });

    var assignProperty = function(entity, related){
        if (self instanceof hasMany)
            entity[self.prop].push(related);
        else
            entity[self.prop] = related;
    };

    /** Make a scalar object identity
     * @param {Object} entity
     *      The entity to identify
     * @param {Array.<String>} fields
     *      Identification fields
     * @returns {String}
     */
    var identity = function(entity, fields){
        return _.values(_.pick(entity, fields)).join('\0');
    };

    var criteria = {},
        lookup = {}
        ;

    return Q()
        // Make up the search criteria & lookup hash table
        .then(function(){
            // Criteria & lookup: defaults
            _.each(self.fields, function(foreignField, localField){
                criteria[foreignField] = { $in: [] };
            });

            // Populate the $in conditions and the lookup
            var val;
            _.each(entities, function(entity){
                // criteria
                _.each(self.fields, function(foreignField, localField){
                    val = entity[localField];
                    if (!_.isUndefined(val) && !_.isNull(val))
                        criteria[foreignField].$in.push(val);
                });

                // lookup
                lookup[identity(entity, _.keys(self.fields))] = entity;
            });
        })
        // Find the related entities
        .then(function(){
            return self.foreign.find(criteria, fields, sort, options); // -> entities
        })
        // Distribute the found related entities
        .then(function(){
            var id, entity;
            _.each(relatedEntities, function(related){
                // Locate an entity
                id = identity(related, _.values(self.fields));
                entity = lookup[ identity(related, _.values(self.fields)) ];

                // Ok?
                if (entity === undefined) // should never happen
                    throw new Error('FAILURE: failed to locate a host entity for ' + id);

                // Assign
                assignProperty(entity, related);
            });
        }).thenResolve(entities);
});






/** "Has one": this model references multiple foreign models through common fields
 * @param {Model} model
 *      The current model
 * @param {String} prop
 *      The property name to store the related entities to
 * @param {Model} foreign
 *      The foreign model
 * @param {String|Array.<String>|Object} fields
 * @constructor
 * @implements {IRelation}
 */
var hasMany = exports.hasMany = function(model, prop, foreign, fields){
    hasOne.call(this, arguments);
};

hasMany.prototype.loadRelated = hasOne.prototype.loadRelated; // the same universal method suits hasMany






///** "Has one": this model references multiple foreign models through an intermediary model
// * @param {Model} model
// *      The current model
// * @param {Model} foreign
// *      The foreign model
// * @constructor
// * @implements {IRelation}
// */
//var manyMany = exports.manyMany = function(model, foreign){
//};
// TODO: manyMany relation.
