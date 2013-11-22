'use strict';

/** Model utilities
 * @fileOverview
 */

var _ = require('lodash'),
    errors = require('../errors')
    ;



/** Apply TypeHandlers using the model field definitions.
 * In other words, this class converts values to and from the DB.
 * @param {Model} model
 * @constructor
 */
var Converter = exports.Converter = function(model){
    this.model = model;
};

/** Convert a field using the named TypeHandler method
 * @param {String} fieldName
 *      Field name
 * @param {String} method
 *      IMissyTypeHandler method name: 'norm', 'load', 'save'
 * @param {*} value
 *      The input value
 * @param {Boolean} [ignore=false]
 *      Ignore fields not defined in the model
 * @returns {*}
 *      The output value
 * @throws {MissyModelError} when the field is not defiend
 * @throws {MissyTypeError} when the convertion has failed
 */
Converter.prototype.convertValue = function(fieldName, method, value, ignore){
    // Pick the TypeHandler
    /** Field definition
     * @type {IModelFieldDefinition}
     */
    var field = this.model.fields[fieldName];
    if (field === undefined){
        if (ignore)
            return value;
        throw new errors.MissyModelError(this.model, 'Convertion of an unknown field: ' + fieldName);
    }

    // Default value
    if (field.required && _.isUndefined(value))
        value = _.isFunction(field.def)? field.def.call(this.model) : field.def;

    // Apply it
    return field._typeHandler[method](value, field)
};

/** Convert an entity.
 * This silently keeps the unknown fields' values unchanged.
 * @param {String} method
 *      IMissyTypeHandler method name: 'norm', 'load', 'save'
 * @param {Object} entity
 *      The entity to convert
 * @returns {Object} The converted copy
 * @throws {MissyModelError} when `entity` is not an object
 */
Converter.prototype.convertEntity = function(method, entity){
    if (!_.isObject(entity))
        throw new errors.MissyModelError(this.model, 'Convertion of a non-object');

    return _.reduce(entity, function(res, value, name){
        res[name] = this.convertValue(name, method, value, true);
        return res;
    }, {}, this);
};






/** Missy Projection object.
 * A projection of fields, normalized and decomposed.
 *
 * @param {Array|Object|MissyProjection?} projection
 *      Fields projection: field names to include/exclude from the resulting object.
 *      Array syntax: array of field names
 *      Object inclusion syntax: { field: 1, .. } - include only the named fields
 *      Object exclusion syntax: { field: 0, .. } - exlude the named fields
 *      By default, selects all fields.
 *
 * @property {Object} projection
 *      A projection using the object syntax
 * @property {Boolean} inclusionMode
 *      Whether the inclusion mode is used: only return the named fields
 *
 * @constructor
 */
var MissyProjection = exports.MissyProjection = function(projection){
    // Empty projection
    if (_.isEmpty(projection)){
        this.projection = {};
        this.inclusionMode = false;
        return;
    }

    // Projection
    if (projection instanceof MissyProjection)
        return _.extend(this, projection);

    // Array syntax
    if (_.isArray(projection)){
        this.projection = _.compose(_.object, _.map)(projection, function(field){
            return [field, 1];
        });
        this.inclusionMode = true;
        return;
    }

    // Object syntax
    this.projection = projection;
    this.inclusionMode = _.any(this.projection);
};

/** Using the projection and a model fields, produce a detailed object
 * @param {Model} model
 * @returns {{ fields: Array.<String>, pick: Array.<String>, omit: Array.<String> }}
 */
MissyProjection.prototype.getFieldDetails = function(model){
    var fields;

    // Empty object
    if (_.isEmpty(this.projection)){
        fields = Object.keys(model.fields);
        return { // pick all model fields
            fields: fields,
            pick: [],
            omit: []
        };
    }

    // Inclusion mode
    if (this.inclusionMode){
        fields = Object.keys(this.projection);
        return { // pick included fields
            fields: fields,
            pick: fields,
            omit: []
        };
    }

    // Exclusion mode
    fields = Object.keys(this.projection);
    return {
        fields: _.difference(Object.keys(model.fields), fields),
        pick: [],
        omit: fields
    };
};

/** Apply projection rules to the entity
 * Is only used in MemoryDriver, but is added here for fullness.
 * @param {Model} model
 * @param {Object} entity
 * @returns {Object}
 */
MissyProjection.prototype.entityApply = function(model, entity){
    var fieldDetails = this.getFieldDetails(model);
    if (fieldDetails.pick.length)
        entity = _.pick(entity, fieldDetails.pick);
    if (fieldDetails.omit.length)
        entity = _.omit(entity, fieldDetails.omit);
    return entity;
};






/** Missy Criteria object
 * A condition on fields, normalized.
 * This silently accepts unknown properties: the driver should decide whether it cares or not.
 *
 * @param {Model?} model
 *      The model to search for.
 * @param {Object|MissyCriteria?} criteria
 *      MongoDB-style simple criteria: { key: value } or { key: { $operator: value }, ... }
 *      All conditions are assumed to be ANDed.
 *      Supported operators:
 *          $gt, $gte, $in, $lt, $lte, $eq, $ne, $nin
 *          $exists
 *      Note: $eq is non-standard, but is here for consistency
 *
 * @property {Object} criteria
 *      Normalized criteria in the following guaranteed form: { key: { $operator: value, ... }, ... }
 *      The values are already converted to DB values.
 *
 * @constructor
 * @throws {MissyModelError} on unknown operator
 * @throws {MissyTypeError} when value convertion fails
 */
var MissyCriteria = exports.MissyCriteria = function(model, criteria){
    this.model = model;
    if (criteria instanceof MissyCriteria)
        return _.extend(this, criteria);

    this.criteria = _.transform(criteria || {}, function(res, test, fieldName){
        // Normalize
        if (!_.isObject(test) || !_.any(test, function(v, operator){ return operator[0]==='$'; }))
            test = { $eq: test };

        // Convert
        var convert = _.partial(model.converter.convertValue.bind(model.converter), fieldName, 'save');

        test = _.transform(test, function(res, operand, operator){ // walk through operands and convert them
            // Known operator?
            if (!_.contains(MissyCriteria.operators, operator))
                throw new errors.MissyModelError(model, 'Unknown operator: ' + operator);

            // Decide what to to with the value
            switch (MissyCriteria.operatorTypes[operator]){
                case 'vector':
                    res[operator] = _.map(operand, function(item){
                        return convert(item, true);
                    });
                    break;
                case 'raw':
                    res[operator] = operand; // unchanged
                    break;
                default:
                    res[operator] = convert(operand, true);
                    break;
            }
        });

        // Finish
        res[fieldName] = test;
    });
};
MissyCriteria.operators = ['$gt', '$gte', '$in', '$lt', '$lte', '$ne', '$eq', '$nin', '$exists']; // supported operators
MissyCriteria.operatorTypes = {
    $in: 'vector',
    $nin: 'vector',
    $exists: 'raw'
};

/** Build a Criteria from the Primary Key values
 * @param {Model} model
 *      The model object
 * @param {*|Array|Object} pk
 *      The primary key
 * @returns {MissyCriteria}
 * @throws {MissyModelError} on empty primary key value
 * @throws {MissyModelError} on invalid PK length
 */
MissyCriteria.fromPk = function(model, pk){
    // undefined PK
    if (_.isUndefined(pk) || _.isNull(pk))
        throw new errors.MissyModelError(model, 'Empty primary key given');

    // scalar PK
    if (!_.isObject(pk) && !_.isArray(pk))
        pk = [pk]; // array will catch it

    // array PK
    if (_.isArray(pk)){
        if (pk.length !== model.options.pk.length)
            throw new errors.MissyModelError(model, 'Inconsistent primary key fields count');
        pk = _.object(model.options.pk, pk); // ordinal zip
    }

    // object PK
    if (_.difference(model.options.pk, Object.keys(pk)).length)
        throw new errors.MissyModelError(model, 'Primary key incomplete');
    return new MissyCriteria(model, pk);
};

/** Test whether the given value matches the operator against an operand.
 * @param {String} operator
 * @param {*} value
 * @param {*} operand
 * @returns {Boolean}
 */
MissyCriteria.matchOperator = function(operator, value, operand){
    switch (operator){
        case '$gt': return value > operand; 
        case '$gte': return value >= operand;
        case '$in': return _.contains(operand, value);
        case '$lt': return value < operand;
        case '$lte': return value <= operand;
        case '$ne': return value != operand;
        case '$eq': return value === operand;
        case '$nin': return !_.contains(operand, value);
        case '$exists': return (value !== undefined) === !!operand;
    }
};

/** Test whether the given entity matches this criteria.
 * Is only used in MemoryDriver, but is added here for fullness.
 * @param {Object} entity
 * @returns {Boolean}
 */
MissyCriteria.prototype.entityMatch = function(entity){
    var self = this;
    return _.all(this.criteria, function(test, fieldName){
        return _.all(test, function(operand, operator){
            return MissyCriteria.matchOperator(operator, entity[fieldName], operand);
        });
    });
};






/** Missy Sort
 *
 * @param {String|Array|Object|MissySort?} sort
 *      Sort fields:
 *      | 'fielda,fieldb+;fieldc-' - string, [,;]-separated,
 *      | ['fielda', 'fieldb+', 'fieldc-']
 *      | { fielda: +1, fieldb: -1, fieldc: '-' }
 *
 * @property {Object} sort
 *      Normalized sort object in the following form:
 *      { fielda: +1, fieldb: -1 }
 *
 * @constructor
 */
var MissySort = exports.MissySort = function(sort){
    if (sort instanceof MissySort)
        return _.extend(this, sort);

    sort = sort || {};

    // Parse string & array syntax
    if (_.isString(sort))
        sort = _.compact(sort.split(/[,;]/));

    if (_.isArray(sort))
        sort = _.compose(_.object, _.map, _.compact)(sort, function(str){
            var m = /(.*)([+-])?/.exec(str);
            return [ m[1], m[2] ];
        });

    // Normalize object
    this.sort = _.transform(sort, function(res, dir, field){
        res[field] = (_.contains([-1, '-1', '-', '0', 0, false, ''], dir))? -1 : +1;
    });
};

/** Sort an array of entities.
 * Is only used in MemoryDriver, but is added here for fullness.
 * @param {Array.<Object>} entities
 *      The array of entities to sort
 * @returns {Array.<Object>} The sorted copy array
 */
MissySort.prototype.entitiesSort = function(entities){
    entities = _.clone(entities);

    // Empty sort: original order
    if (_.isEmpty(this.sort))
        return entities;

    // Custom sort
    entities.sort(function(a,b){
        return _.reduce(this.sort, function(res, dir, fieldName){
            if (res !== 0)
                return res; // don't check further when the comparison is already defined
            // Compare 2 fields
            if (a[fieldName] === b[fieldName])
                return 0;
            return (a[fieldName] < b[fieldName])? -dir : +dir;
        }, 0);
    }.bind(this));

    // Finish
    return entities;
};
