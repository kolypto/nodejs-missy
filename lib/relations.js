'use strict';

/** Missy Model relations
 * @fileOverview
 */

var Q = require('q'),
    u = require('./util'),
    errors = require('./errors'),
    _ = require('lodash')
    ;



/** "Has one": this model references a foreign one through common fields
 * @param {Model} model
 *      The current model
 * @param {String} prop
 *      The property name to store the related entities to
 * @param {Model} foreign
 *      The foreign model
 * @param {String|Array.<String>|Object} fields
 *      The matching field names:
 *      | String:   a common field name
 *      | Array:    multiple common field names
 *      | Object:   local field names mapped to foreign field names
 *
 * @property {Object.<String,String>} fields
 *
 * @constructor
 * @implements {IMissyRelation}
 */
var hasOne = exports.hasOne = function(model, prop, foreign, fields){
    this.model = model;
    this.prop = prop;
    this.foreign = foreign;
    this.fields = hasOne._prepareFields(fields);
};
hasOne.prototype.arrayRelation = false;

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

/** Make a scalar object identity
 * @param {Object} entity
 *      The entity to identify
 * @param {Array.<String>} fields
 *      Identification fields
 * @returns {String}
 */
var entityId = function(entity, fields){
    return _.values(_.pick(entity, fields)).join('\0');
};

hasOne.prototype.loadRelated = Q.fbind(function(entities, fields, sort, options){
    var self = this,
        hostFields = _.keys(self.fields),
        foreignFields = _.values(self.fields)
        ;

    // Arguments test
    if (fields){
        fields = new u.MissyProjection(fields);
        if (!fields.includesFields( foreignFields ))
            throw new errors.MissyRelationError(this, 'Projection drops foreign keys');
    }

    // Prepare array properties
    _.each(entities, function(entity){
        entity[self.prop] = (self.arrayRelation)? [] : undefined;
    });

    // Helpers
    var assignProperty = function(entity, related){
        if (self.arrayRelation)
            entity[self.prop].push(related);
        else
            entity[self.prop] = related;
    };

    // Prepare

    /** Foreign model find() criteria
     * @type {Object} for MissyCriteria
     */
    var criteria = {};

    /** Lookup hash table which maps foreign entity PK fields (joint string) to local entities
     * @type {Object.<String, Object>}
     */
    var lookup = {};

    return Q()
        // Make up the search criteria & lookup hash table
        .then(function(){
            // Criteria & lookup: defaults
            _.each(self.fields, function(foreignField, localField){
                criteria[foreignField] = { $in: [] };
            });

            // Populate the $in conditions and the lookup
            // FIXME: when used on N fields, it can potentially fetch many unnecessary entities. Fix that with $or when the support for it jumps in
            var val, id;
            _.each(entities, function(entity){
                // criteria
                _.each(self.fields, function(foreignField, localField){
                    val = entity[localField];
                    if (!_.isUndefined(val) && !_.isNull(val))
                        criteria[foreignField].$in.push(val);
                });

                // lookup
                id = entityId(entity, hostFields);
                if (!(id in lookup))
                    lookup[id] = [];
                lookup[id].push(entity); // there can be multiple entities with the same identity, and this shouldn't confuse us
            });

            // Remove duplicates
            _.each(criteria, function(test){
                test.$in = _.uniq(test.$in);
            });
        })
        // Find the related entities
        .then(function(){
            return self.foreign.find(criteria, fields, sort, options); // -> entities
        })
        // Distribute the found related entities
        .then(function(relatedEntities){
            var id, hostEntities;

            _.each(relatedEntities, function(related){
                // Locate an entity
                id = entityId(related, foreignFields);
                hostEntities = lookup[ id ];

                // Ok?
                if (hostEntities === undefined) // should never happen
                    throw new errors.MissyRelationError('FAILURE: failed to locate a host entity for ' + id);

                // Assign
                _.each(hostEntities, function(hostEntity){
                    assignProperty(hostEntity, related);
                });
            });
        }).thenResolve(entities);
});

hasOne.prototype.saveRelated = function(entities, options){
    var self = this,
        hostFields = _.keys(self.fields),
        foreignFields = _.values(self.fields)
        ;

    return Q()
        // Set up foreign keys on the related entities
        .then(function(){
            var relatedEntities = [];

            // Set up foreign keys
            _.each(entities, function(entity){
                if (_.isEmpty(entity[self.prop]))
                    return;
                var pk = _.object(foreignFields, _.values(_.pick(entity, hostFields)));
                _.each([].concat(entity[self.prop]), function(relatedEntity){
                    _.extend(relatedEntity, pk);
                    relatedEntities.push(relatedEntity);
                });
            });

            return relatedEntities;
        })
        // Remove the previous set of related entities
        .then(function(relatedEntities){
            // Don't remove the related entities we're going to insert
            return Q()
                .then(function(){
                    if (hostFields.length === 1){
                        // Can just search by PK
                        var criteria = {};
                        criteria[ foreignFields[0] ] = {
                            $in: _.pluck(entities, hostFields[0]),
                            $nin: _.pluck(relatedEntities, foreignFields[0])
                        };
                        return self.foreign.removeQuery(criteria, options);
                    } else {
                        // FIXME: when used on N fields, it needs too many queries. Fix that with $or when the support for it jumps in

                        // Load them all & remove
                        return self.model.loadRelated(_.map(entities, _.clone), self.prop )
                            .then(function(entities){
                                var relatedEntities = _.flatten(_.compact(_.pluck(entities, self.prop)), true);

                                // Decide which of them to remove
                                var lookup = _.indexBy(entities, _.partialRight(entityId, hostFields));
                                relatedEntities = _.filter(relatedEntities, function(entity){
                                    return !(entityId(entity, foreignFields) in lookup);
                                });

                                return self.foreign.remove(relatedEntities);
                            });
                    }
                })
                .thenResolve(relatedEntities);
        })
        // Save related entities
        .then(function(relatedEntities){
            return self.foreign.save(relatedEntities, options);
        })
        .thenResolve(entities);
};

hasOne.prototype.removeRelated = function(entities, options){
    var self = this,
        hostFields = _.keys(self.fields),
        foreignFields = _.values(self.fields)
        ;

    return Q()
        .then(function(){
            if (hostFields.length === 1){
                // Can just search by PK
                var criteria = {};
                criteria[ foreignFields[0] ] = { $in: _.pluck(entities, hostFields[0]) };
                return self.foreign.removeQuery(criteria, options);
            } else {
                // FIXME: when used on N fields, it needs too many queries. Fix that with $or when the support for it jumps in

                // Load them all & remove
                return self.model.loadRelated(_.map(entities, _.clone), self.prop )
                    .then(function(entities){
                        var relatedEntities = _.flatten(_.compact(_.pluck(entities, self.prop)), true);
                        return self.foreign.remove(relatedEntities);
                    });
            }
        })
        .thenResolve(entities);
};






/** "Has many": this model references multiple foreign models through common fields
 * @param {Model} model
 *      The current model
 * @param {String} prop
 *      The property name to store the related entities to
 * @param {Model} foreign
 *      The foreign model
 * @param {String|Array.<String>|Object} fields
 *      The matching field names
 * @constructor
 * @implements {IMissyRelation}
 */
var hasMany = exports.hasMany = function(model, prop, foreign, fields){
    hasOne.apply(this, arguments);
};
hasMany.prototype.arrayRelation = true;

hasMany.prototype.loadRelated = hasOne.prototype.loadRelated;
hasMany.prototype.saveRelated = hasOne.prototype.saveRelated;
hasMany.prototype.removeRelated = hasOne.prototype.removeRelated;






///** "Has one": this model references multiple foreign models through an intermediary model
// * @param {Model} model
// *      The current model
// * @param {Model} foreign
// *      The foreign model
// * @constructor
// * @implements {IMissyRelation}
// */
//var manyMany = exports.manyMany = function(model, foreign){
//};
// TODO: manyMany relation.
