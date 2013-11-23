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
 * @return {Q} promise for {Array.<Object>}
 */
IRelation.prototype.loadRelated = function(entities){
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

hasOne.prototype.loadRelated = Q.fbind(function(entities){
    var self = this,
        criteria,
        lookup;

    /* This messy method considers 2 options:
     * 1. models are related using a single column. This simplifies much
     * 2. models are related using multiple columns. Ouch: we'll need to perform manual joins
     *
     * Also, this code is reusable for hasMany: the only difference is that the model property should be an array.
     */

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

    // Simple case with 1 common field
    if (Object.keys(self.fields).length === 1){
        // shortcuts
        var localField = _.keys(self.fields)[0],
            foreignField = _.values(self.fields)[0]
            ;

        return Q()
            // Make up the search criteria & lookup hash table
            .then(function(){
                // Criteria & lookup: defaults
                criteria = _.object([  [foreignField], [{ $in: [] }]  ]);
                lookup = {};

                // Populate the $in conditions and the lookup
                _.each(entities, function(entity){
                    criteria[foreignField].$in.push(entity[localField]);
                    lookup[entity[localField]] = entity;
                });
            })
            // Find the related entities
            .then(function(){
                return self.foreign.find(criteria); // -> entities
            })
            // Distribute the found related entities
            .then(function(){
                var entity;
                _.each(relatedEntities, function(related){
                    // Locate an entity
                    entity = lookup[ related[foreignField] ];

                    // Ok?
                    if (entity === undefined) // should never happen
                        throw new Error('FAILURE: failed to locate a host entity for ' + related);

                    // Assign
                    assignProperty(entity, related);
                });
            }).thenResolve(entities);
    }

    // Hard case with N common fields
    // When mapping by N common fields, individual field values are not unique so simple hash lookup is not an option
    return Q()
        // Make up the search criteria & lookup hash table
        .then(function(){
            // Criteria & lookup: defaults
            criteria = {};
            lookup = {};
            _.each(self.fields, function(foreignField, localField){
                criteria[foreignField] = { $in: [] };
                lookup[foreignField] = {};
            });

            // Populate the $in conditions and the lookup
            _.each(entities, function(entity){
                var val;
                _.each(self.fields, function(foreignField, localField){
                    val = entity[localField];
                    if (!_.isUndefined(val) && !_.isNull(val)){ // ignore falsy values
                        // criteria
                        criteria[foreignField].$in.push(val);

                        // lookup
                        // When mapping by N common fields, individual field values are not unique
                        if (!(val in lookup[foreignField]))
                            lookup[foreignField] = [];
                        lookup[foreignField][val].push(entity);
                    }
                });
            });
        })
        // Find the related entities
        .then(function(){
            return self.foreign.find(criteria); // -> entities
        })
        // Distribute the found related entities
        .then(function(){
            // Columns are not unique, so each time we search for an intersectioning entity
            var entity;
            _.each(relatedEntities, function(related){
                // Locate an entity
                entity = _.intersection(
                    _.map(
                        _.pick(related, _.values(self.fields)),
                        function(value, foreignField){
                            return lookup[foreignField][value];
                        }
                    )
                );

                // Ok?
                if (entity.length !== 1) // should never happen
                    throw new Error('FAILURE: located ' + entity.length + ' host entites for ' + related);

                // Assign
                assignProperty(entity[0], related);
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
    hasOne.prototype.call(this, arguments);
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
// TODO: manyMany relation
