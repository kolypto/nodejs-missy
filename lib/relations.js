'use strict';

/** Missy Model relations
 * @fileOverview
 */

var Q = require('q'),
    u = require('./util'),
    errors = require('./errors'),
    _ = require('lodash')
    ;



/** Relation interface object
 *
 * @property {Model} model
 *      Local model object
 * @property {String} prop
 *      Local property name
 * @property {Model} foreign
 *      Foreign model object
 * @property {Boolean} arrayRelation
 *      Whether the relation produces an array of entities
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
 *      The matching field names:
 *      | String:   a common field name
 *      | Array:    multiple common field names
 *      | Object:   local field names mapped to foreign field names
 *
 * @property {Object.<String,String>} fields
 *
 * @constructor
 * @implements {IRelation}
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

hasOne.prototype.loadRelated = Q.fbind(function(entities, fields, sort, options){
    var self = this;
    // TODO: slice entities when there are too many

    // Arguments test
    if (fields){
        fields = new u.MissyProjection(fields);
        if (!fields.includesFields( _.values(this.fields) ))
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
                id = identity(entity, _.keys(self.fields));
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
                id = identity(related, _.values(self.fields));
                hostEntities = lookup[ identity(related, _.values(self.fields)) ];

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
 * @implements {IRelation}
 */
var hasMany = exports.hasMany = function(model, prop, foreign, fields){
    hasOne.apply(this, arguments);
};
hasMany.prototype.arrayRelation = true;

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
