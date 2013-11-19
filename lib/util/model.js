'use strict';

/** Model utilities
 * @fileOverview
 */

var _ = require('lodash'),
    errors = require('../errors')
    ;


/** Model field utils
 * @param {Model} model
 * @constructor
 */
var FieldUtils = exports.FieldUtils = function(model){
    this.model = model;
};

/** Normalize the given Primary Key values into an object of { key: value }
 * @param {*|Array|Object} pk
 * @returns {Object}
 * @throws {MissyModelError} on empty primary key value
 * @throws {MissyModelError} on invalid PK length
 */
FieldUtils.prototype.normalizePk = function(pk){
    // undefined PK
    if (_.isUndefined(pk) || _.isNull(pk))
        throw new error.MissyModelError(this.model, 'Empty primary key given');

    // scalar PK
    if (!_.isObject(pk) && !_.isArray(pk))
        pk = [pk]; // array will catch it

    // array PK
    if (_.isArray(pk)){
        if (pk.length !== this.options.pk.length)
            throw new error.MissyModelError(this.model, 'Inconsistent primary key fields count');
        return _.object(this.options.pk, pk); // ordinal zip
    }

    // object PK
    return pk;
};



/** Apply TypeHandlers using the model field definitions.
 * In other words, this class converts values to and from the DB.
 * @param {Model} model
 * @constructor
 */
var Converter = exports.Converter = function(model){
    this.model = model;
};

/** Convert a field using the named
 * @param {String} name
 *      Field name
 * @param {String} method
 *      IMissyTypeHandler method name: 'norm', 'load', 'save'
 * @param {*} value
 *      The input value
 * @returns {*}
 *      The output value
 * @throws {MissyModelError} when the field is not defiend
 * @throws {MissyTypeError} when the convertion has failed
 */
Converter.convertValue = function(name, method, value){
    // Pick the TypeHandler
    var field = this.model.fields[name];
    if (field === undefined)
        throw new errors.MissyModelError(this.model, 'Convertion of an unknown field: ' + name);

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
Converter.convertEntity = function(method, entity){
    if (!_.isObject(entity))
        throw new errors.MissyModelError(this.model, 'Convertion of a non-object');

    return _.reduce(entity, function(res, value, name){
        if (!(name in this.model.fields))
            res[key] = value;
        else
            res[key] = this.convertValue(name, method, value);
        return res;
    }, {}, this);
};


Converter.convertPrimaryKey = function(method, pk){

};






/** A projection of fields, normalized and decomposed.
 *
 * @param {Array|Object?} projection
 *
 * @property {Object} projection
 *      A projection using the object syntax
 * @property {Boolean} inclusionMode
 *      Whether the inclusion mode is used: only return the named fields
 *
 * @constructor
 */
var Projection = exports.Projection = function(projection){
    // Empty projection
    if (_.isEmpty(projection)){
        this.projection = {};
        return;
    }

    // Array syntax
    if (_.isArray(projection)){
        this.projection = _.compose(_.object, _.map)(projection, function(field){
            return [field, 1];
        });
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
Projection.prototype.getFieldDetails = function(model){
    var fields;

    // Empty object
    if (_.isEmpty(this.projection)){
        fields = Object.keys(model.fields);
        return { // pick all model fields
            fields: fields,
            pick: fields,
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





