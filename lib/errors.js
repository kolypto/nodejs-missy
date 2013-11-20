'use strict';

/** Error objects
 * @fileOverview
 */

var util = require('util')
    ;



/** Base Missy Error
 *
 * @constructor
 * @extends {Error}
 */
var MissyError = exports.MissyError = function(message){
    Error.call(this, message);
    Error.captureStackTrace(this, this.constructor);
    this.message = message;
};
util.inherits(MissyError, Error);
MissyError.prototype.name = 'MissyError';



/** Missy Type error
 * @param {IMissyTypeHandler} type
 * @param {String} message
 *
 * @property {String} type
 *
 * @constructor
 * @extends {MissyError}
 */
var MissyTypeError = exports.MissyTypeError = function(type, message){
    this.type = type.name;
    MissyError.call(this, this.type + ': ' + message);
    Error.captureStackTrace(this, this.constructor);
};
util.inherits(MissyTypeError, MissyError);
MissyTypeError.prototype.name = 'MissyTypeError';



/** Missy driver error
 *
 * @param {IMissyDriver} driver
 * @param {String} message
 *
 * @property {String} driver
 *
 * @constructor
 * @extends {MissyError}
 */
var MissyDriverError = exports.MissyDriverError = function(driver, message){
    this.model = driver.name;
    MissyError.call(this, this.model + ': ' + message);
    Error.captureStackTrace(this, this.constructor);
};
util.inherits(MissyDriverError, MissyError);
MissyDriverError.prototype.name = 'MissyDriverError';



/** Missy model error
 *
 * @param {Model} model
 * @param {String} message
 *
 * @property {String} model
 *
 * @constructor
 * @extends {MissyError}
 */
var MissyModelError = exports.MissyModelError = function(model, message){
    this.model = model.name;
    MissyError.call(this, this.model + ': ' + message);
    Error.captureStackTrace(this, this.constructor);
};
util.inherits(MissyModelError, MissyError);
MissyModelError.prototype.name = 'MissyModelError';



/** Missy model validation error
 *
 * @param {Model} model
 * @param {String} message
 *
 * @property {String} model
 *
 * @constructor
 * @extends {MissyModelError}
 */
var MissyValidationError = exports.MissyValidationError = function(model, message){
    MissyModelError.call(this, model, message);
    Error.captureStackTrace(this, this.constructor);
};
util.inherits(MissyValidationError, MissyModelError);
MissyValidationError.prototype.name = 'MissyValidationError';



/** Entity error: already exists
 * @param {Model} model
 * @param {Object} entity
 * @constructor
 * @extends {MissyError}
 */
var EntityExists = function(model, entity){
    this.model = model.name;
    this.entity = entity;
    MissyError.call(this, 'Entity exists: ' + this.model);
};
util.inherits(EntityExists, MissyError);
MissyError.prototype.name = 'EntityExists';

/** Entity error: already exists
 * @param {Model} model
 * @param {Object} entity
 * @constructor
 * @extends {MissyError}
 */
var EntityNotFound = function(model, entity){
    this.model = model.name;
    this.entity = entity;
    MissyError.call(this, 'Entity not found: ' + this.model);
};
util.inherits(EntityNotFound, MissyError);
MissyError.prototype.name = 'EntityNotFound';
