'use strict';

var _ = require('lodash'),
    ModelOptions = require('./options').ModelOptions,
    util = require('./util')
    ;

/** Model
 *
 * @param {Schema} schema
 *      The parent schema
 * @param {String} name
 *      Model name
 * @param {Object.<String, IModelFieldDefinition>} fields
 *      Model fields' definitions
 * @param {ModelOptions} options
 *      Model options
 *
 * @constructor
 */
var Model = exports.Model = function(schema, name, fields, options){
    this.schema = schema;
    this.name = name;

    // Prepare fields
    this.fields = _.compose(_.object, _.compact, _.map)(fields, this._prepareFieldDefinition, this);
    this.options = ModelOptions.prepare(this, options);

    // Private tools
    this._converter = new util.model.Converter(this);
    this._fieldutils = new util.model.FieldUtils(this);
};

/** Prepare the fields definition
 * @param {String} name
 * @param {IModelFieldDefinition} field
 * @returns {Array?} [name, field] or `undefined` to skip it
 * @throws {MissyModelError} When the definition is incorrect (missing `type` property)
 * @throws {MissyModelError} When the requested `type` is not defined
 * @protected
 */
Model.prototype._prepareFieldDefinition = function(name, field){
    // Type
    switch(field){
        case String: field = { type: 'string' }; break;
        case Number: field = { type: 'number' }; break;
        case Date: field = { type: 'date' }; break;
        case Object: field = { type: 'object' }; break;
        case Array: field = { type: 'array' }; break;
    }

    // The driver might have its own thoughts
    var tmp = this.schema.driver._prepareFieldDefinition(model, name, field);
    name = tmp[0]; field = tmp[1];

    // Still ok?
    if (name === undefined || field === undefined)
        return undefined;

    // Validation
    if (field.type === undefined)
        throw new errors.MissyModelError('Incorrect definition given for field `'+ name +'`');

    // `type`, `_typeHandler`: Pick the type handler
    if (field._typeHandler === undefined){ // the driver might have already set it
        var type = this.schema.types[field.type];
        if (type === undefined)
            throw new errors.MissyModelError('Undefined type "'+field.type+'" for field `'+ name +'`');
        field._typeHandler = this.schema.types[field.type];
    }

    // Default values
    _.defaults(field, {
        required: this.options.required || false,
        _model: this
    });

    return [name, field];
};



//region Public API

/** Get a single entity by its primary key
 * @param {*|Array|Object} pk
 *      The primary key value.
 *      In case of a compound PK, use an object of values.
 * @param {Array|Object?} fields
 *      Fields projection: field names to include/exclude from the resulting object.
 *      Array syntax: array of field names
 *      Object inclusion syntax: { field: 1, .. } - include only the named fields
 *      Object exclusion syntax: { field: 0, .. } - exlude the named fields
 *      By default, selects all fields.
 * @param {function(Error?, entity: Object?)} callback
 *      Callback to receive the found object, or NULL when not found.
 * @throws {MissyModelError} invalid primary key
 */
Model.prototype.get = function(pk, fields, callback){
    // Optional arguments
    if (_.isFunction(fields) && _.isUndefined(callback)){ // (pk, callback)
        callback = fields;
        fields = undefined;
    }

    // Prepare the projection
    var projection = new util.model.Projection(fields);

    // Normalize the PK into an object & convert
    pk = this._fieldutils.normalizePk(pk);
    pk = this._converter.convertEntity('save', pk);

    // Delegate the search to the driver
    this.driver.findOne(pk, projection, function(err, entity){
        if (err)
            return callback(err);
        if (_.isNull(entity))
            return callback(undefined, entity);
        entity = this._converter.convertEntity('load', entity);
        callback(undefined, entity);
    }.bind(this));
};

// TODO: use promises??

//endregion
