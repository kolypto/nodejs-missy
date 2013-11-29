'use strict';

exports.Schema = require('./Schema').Schema;
exports.Model = require('./Model').Model;
exports.relations = require('./relations');
exports.errors = require('./errors');

exports.util = require('./util');
exports.types = require('./types');
exports.drivers = require('./drivers');

/** Register a Missy driver
 * @param {String} name
 *      Driver name
 * @param {Function} Driver
 *      Driver class
 */
exports.registerDriver = function(name, Driver){
    exports.drivers[name] = Driver;
};

/** Missy helper to load a driver
 * @returns {Object}
 */
exports.loadDriver = function(){
    for (var i = 0; i<arguments.length; i++)
        require('missy-' + arguments[i]);
    return exports;
};
