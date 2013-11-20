'use strict';

var Q = require('q'),
    _ = require('lodash'),
    MissyHooks = require('../lib/util').MissyHooks
    ;

/** Test MissyHooks with an empty list
 * @param {test|assert} test
 */
exports.testMissyHooks = function(test){
    var h;

    // Empty object
    h = new MissyHooks();

    // Event
    h.on('unknown-hook', function(a,b,c){
        test.deepEqual([a,b,c],[1,2,3]);
    });

    h.invokeHook('unknown-hook', 1,2,3).done();

    // Hook
    h.registerHook('unknown-hook', function(a,b,c){
        test.deepEqual([a,b,c],[1,2,3]);
    });
    h.registerHook('unknown-hook', function(a,b,c){
        test.deepEqual([a,b,c],[1,2,3]);
    });
    h.invokeHook('unknown-hook', 1,2,3).then(function(){
        test.expect(4);
        test.done();
    }).done();
};

/** Test MissyHooks with a list
 * @param {test|assert} test
 */
exports.testMissyHooks_list = function(test){
    var h;

    // Empty object
    h = new MissyHooks([ 'before', 'after', 'instead' ]);

    // Error
    test.throws(function(){
        h.register('lol', function(){});
    }, Error, 'Using an unsupported hook name: "lol"');

    // Event
    h.on('before', function(a,b,c){
        test.deepEqual([a,b,c],[1,2,3]);
    });

    h.invokeHook('before', 1,2,3).done();
    h.before(1,2,3);

    // Hook
    h.registerHook('before', function(a,b,c){
        test.deepEqual([a,b,c],[1,2,3]);
    });
    h.before = function(a,b,c){
        test.deepEqual([a,b,c],[1,2,3]);
    };
    h.invokeHook('before', 1,2,3).then(function(){
        test.expect(6);
        test.done();
    }).done();
};
