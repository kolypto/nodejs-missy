'use strict';

var events = require('events'),
    util = require('util'),
    Q = require('q'),
    _ = require('lodash')
    ;

/** Hook system for Missy
 * Supports synchronous hooks, promise-based asynchronous hooks.
 * Each hook call is also translated to an event with the same name.
 *
 * To set a hook handler, use either:
 * - hooks.registerHook('name', function(){ ... }); - sync hook
 * - hooks.on('name', function(){ ... }); - async hook
 * - hooks.name = function(){ ... }; - sugar. Only works when `hookNames` is provided
 *
 * @param {Array.<String>?} hookNames
 *      The list of supported hooks.
 *      When empty, you can use arbitrary hooks but will loose the 'get/set' magic.
 *
 * @constructor
 * @extends {EventEmitter}
 */
var MissyHooks = exports.MissyHooks = function(hookNames){
    this._hookNames = hookNames;
    this._hooks = {};

    // get/set magic
    if (this._hookNames){
        _.each(this._hookNames, function(name){
            Object.defineProperty(this, name, {
                enumerable: true,
                configurable: false,
                get: function(){
                    return _.partial(this.invokeHook.bind(this), name);
                },
                set: function(hook){
                    return this.registerHook(name, hook);
                }
            });
        }, this);
    }
};
util.inherits(MissyHooks, events.EventEmitter);

/** Check hook name against the allowed list
 * @param {String} name
 * @throws {Error}
 * @private
 */
MissyHooks.prototype._checkHookName = function(name){
    if (this._hookNames && !_.contains(this._hookNames, name))
        throw new Error('Using an unsupported hook name: "'+ name +'"');
};

/** Get the list of available hooks
 * @returns {Array.<String>}
 */
MissyHooks.prototype.getHookNames = function(){
    return this._hookNames;
};

/** Register a function for the hook
 * @param {String} name
 *      Hook name
 * @param {Function} handler
 *      Hook function to add
 * @returns {Function}
 */
MissyHooks.prototype.registerHook = function(name, handler){
    this._checkHookName(name);
    if (!(name in this._hooks))
        this._hooks[name] = [];
    this._hooks[name].push(handler);
    return handler;
};

/** Unregister a function from the hook
 * @param {String} name
 *      Hook name
 * @param {Function} handler
 *      Hook function to remove
 * @returns {Function}
 */
MissyHooks.prototype.unregisterHook = function(name, handler){
    this._checkHookName(name);
    if (!(name in this._hooks))
        return;
    this._hooks[name] = _.without(this._hooks[name], handler);
};

/** Unregister all handlers from the given hook
 * @param {String} name
 *      Hook name
 */
MissyHooks.prototype.unregisterAllHooks = function(name){
    if (name in this._hooks)
        delete this._hooks[name];
};

/** Invoke all registered hook handlers for the given hook
 * @param {String} name
 * @param {...*} args
 * @returns {Q} a promise for `args`
 */
MissyHooks.prototype.invokeHook = function(name){
    // Arguments
    this._checkHookName(name);
    var args = Array.prototype.slice.call(arguments, 1);

    // Invoke
    try {
        if (!(name in this._hooks))
            return Q.fulfill(args);

        return this._hooks[name].reduce(function(cur, next){
            return cur.then(function(){
                return next.apply(undefined, args);
            });
        }, Q(1)).thenResolve(args);
    } finally {
        // Finally, emit an event
        this.emit.apply(this, [name].concat(args));
    }
};
