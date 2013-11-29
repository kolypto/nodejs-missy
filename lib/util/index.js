'use strict';

/** Utilities
 * @fileOverview
 */

var _ = require('lodash')
    ;

var model = require('./model');
exports.Converter = model.Converter;
exports.MissyCriteria = model.MissyCriteria;
exports.MissyProjection = model.MissyProjection;
exports.MissySort = model.MissySort;
exports.MissyUpdate = model.MissyUpdate;
exports.MissyHooks = require('./hooks').MissyHooks;

/** Check whether the interface is implemented
 * @param {Object} Interface
 * @param {Object} Type
 * @returns {boolean}
 */
exports.interfaceImplemented = function(Interface, Type, missingMethods){
    var missing = _.difference(
        _.methods(Interface),
        _.methods(Type)
    );
    if (missingMethods)
        missingMethods.push(missing);
    return (missing.length === 0);
};
