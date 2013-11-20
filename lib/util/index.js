'use strict';

/** Utilities
 * @fileOverview
 */

var _ = require('lodash')
    ;

exports.model = require('./model');

/** Check whether the interface is implemented
 * @param {Object} Interface
 * @param {Object} Type
 * @returns {boolean}
 */
exports.interfaceImplemented = function(Interface, Type){
    var missingMethods = _.difference(
        _.methods(Interface),
        _.methods(Type)
    );
    return (missingMethods.length === 0);
};
