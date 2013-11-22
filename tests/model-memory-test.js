'use strict';

var Q = require('q'),
    _ = require('lodash'),
    Schema = require('../lib').Schema,
    MemoryDriver = require('../lib').drivers.MemoryDriver,
    errors = require('../lib/errors')
    ;

Q.longStackSupport = true;

/** Test Model on MemoryDriver
 * @param {test|assert} test
 */
exports.testModel_MemoryDriver = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {})
        ;

    // Model
    var Log = schema.define('Log', {
        id: Number,
        level: { type: 'number', required: true },
        title: String,
        tags: Array,
        entry: Object
    }, { pk: ['id'] });

    // Hook testing stuff
    var testHooks = _.compose(_.object, _.map)([Log], function(Model){
        var hooksTester = {
            // Init all model hooks to 0 and register hook counters
            _counts: _.compose(_.object, _.map)(Model.hooks.getHookNames(), function(hook){
                Model.hooks[hook] = function(){
                    hooksTester._counts[hook]++;
                };
                return [hook, 0];
            }),
            _prev: {}, // previous hook fire counts for comparison
            /** Make a snapshot of the current state
             * @private
             */
            _snapshot: function(){
                hooksTester._prev = _.clone(hooksTester._counts);
            },
            /** Test whether hook fire counts matches the expectations
             * @param {Object.<String,Number>} hooks Fire counts
             */
            fired: function(hooks){
                var expected = _.clone(this._prev);
                _.each(hooks, function(hits, hook){
                    expected[hook] += hits;
                });
                test.deepEqual(hooksTester._counts, expected);
                hooksTester._counts = expected;
                hooksTester._snapshot();
            }
        };
        hooksTester._snapshot();
        return [Model.name, hooksTester];
    });

    // Helpers
    var shouldNever = function(title){
        return function(e){
            test.ok(false, 'Should never get here: ' + title, arguments);
            if (e && e instanceof Error)
                console.error(e.stack);
        };
    };

    // Test
    [
        // Insert 1
        function(){
            return Log.insert({ id: 1, level: 0, title: 'first', tags: ['a','b','c'] })
                .then(function(entity){
                    test.deepEqual(entity, { id: 1, level: 0, title: 'first', tags: ['a','b','c'] });
                    test.deepEqual(driver._storage.slice(0), [ entity ]);
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeInsert:1,
                        beforeLoading:1,
                        afterLoading:1,
                        afterInsert:1
                    });
                }).catch(shouldNever('insert 1 fail'));
        },
        // Insert array[2]
        function(){
            return Log.insert([
                { id: '2', level: '0', title: 'second', entry: {a:1,b:2,c:3} },
                { id: 3, level: 1, title: 'third' }
            ]).then(function(entities){
                    test.deepEqual(entities, [
                        { id: 2, level: 0, title: 'second', entry: {a:1,b:2,c:3} }, // '2', '0' converted
                        { id: 3, level: 1, title: 'third' }
                    ]);
                    test.deepEqual(driver._storage.slice(1), entities); // inserted
                    testHooks.Log.fired({
                        beforeSaving:2,
                        afterSaving:2,
                        beforeInsert:1,
                        beforeLoading:2,
                        afterLoading:2,
                        afterInsert:1
                    });
                }).catch(shouldNever('insert array[2] fail'));
        },
        // Insert non-unique: fail
        function(){
            return Log.insert({ id: 1 })
                .then(shouldNever('insert non-unique success'))
                .catch(function(e){
                    test.equal(driver._storage.length, 3); // length not changed
                    test.ok(e instanceof errors.EntityExists); // error ok
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeInsert:1
                        // no more hooks due to error
                    });
                });
        },
        // Update 1
        function(){
            return Log.update({ id: 1, level: '0', title: 'First', tags: ['a','b','c','d'] })
                .then(function(entity){
                    test.deepEqual(entity, { id: 1, level: 0, title: 'First', tags: ['a','b','c','d'] }); // '0' converted
                    test.deepEqual(driver._storage.slice(0,1), [ entity ]); // replaced
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeUpdate:1,
                        beforeLoading:1,
                        afterLoading:1,
                        afterUpdate:1
                    });
                }).catch(shouldNever('update 1 fail'));
        },
        // Update array[2]
        function(){
            return Log.update([
                    { id: '2', level: '0', title: 'Second', entry: {a:1,b:2,c:3,d:4} },
                    { id: 3, level: 1, title: 'Third' }
                ]).then(function(entities){
                    test.deepEqual(entities, [
                        { id: 2, level: 0, title: 'Second', entry: {a:1,b:2,c:3,d:4} }, // '2', '0' converted
                        { id: 3, level: 1, title: 'Third' }
                    ]);
                    test.deepEqual(driver._storage.slice(1), entities); // inserted
                    testHooks.Log.fired({
                        beforeSaving:2,
                        afterSaving:2,
                        beforeUpdate:1,
                        beforeLoading:2,
                        afterLoading:2,
                        afterUpdate:1
                    });
                }).catch(shouldNever('update array[2] fail'));
        },
        // Update non-existing
        function(){
            return Log.update({ id: 100 })
                .then(shouldNever('update non-existing success'))
                .catch(function(e){
                    test.equal(driver._storage.length, 3); // length not changed
                    test.ok(e instanceof errors.EntityNotFound); // error ok
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeUpdate:1
                        // no more hooks due to error
                    });
                });
        },
        // Save 1 new
        function(){
            return Log.save({ id: 4, level: '2', title: 'fourth' })
                .then(function(entity){
                    test.deepEqual(entity, { id: 4, level: 2, title: 'fourth' }); // '2' converted
                    test.deepEqual(driver._storage.slice(3), [ entity ]);
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeSave:1,
                        beforeLoading:1,
                        afterLoading:1,
                        afterSave:1
                    });
                }).catch(shouldNever('save 1 new fail'));
        },
        // Save 1 existing
        function(){
            return Log.save({ id: 1, level: 0, title: 'first', tags: ['a','b','c'] })
                .then(function(entity){
                    test.deepEqual(entity, { id: 1, level: 0, title: 'first', tags: ['a','b','c'] });
                    test.deepEqual(driver._storage.slice(0,1), [ entity ]);
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeSave:1,
                        beforeLoading:1,
                        afterLoading:1,
                        afterSave:1
                    });
                }).catch(shouldNever('save 1 existing fail'));
        },
        // TODO: Save array[2] new
        // TODO: Save array[2] existing
        // TODO: Save array[2] new & existing
    ].reduce(Q.when, Q(1))
        .catch(shouldNever('Test error'))
        .then(function(){
            test.done();
        }).done();
};
