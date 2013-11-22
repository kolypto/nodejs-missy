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
        // Upsert 1 new
        function(){
            return Log.upsert({ id: 4, level: '2', title: 'fourth' })
                .then(function(entity){
                    test.deepEqual(entity, { id: 4, level: 2, title: 'fourth' }); // '2' converted
                    test.deepEqual(driver._storage.slice(3), [ entity ]);
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeUpsert:1,
                        beforeLoading:1,
                        afterLoading:1,
                        afterUpsert:1
                    });
                }).catch(shouldNever('upsert 1 new fail'));
        },
        // Upsert 1 existing
        function(){
            return Log.upsert({ id: 1, level: 0, title: 'first', tags: ['a','b','c'] })
                .then(function(entity){
                    test.deepEqual(entity, { id: 1, level: 0, title: 'first', tags: ['a','b','c'] });
                    test.deepEqual(driver._storage.slice(0,1), [ entity ]);
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeUpsert:1,
                        beforeLoading:1,
                        afterLoading:1,
                        afterUpsert:1
                    });
                }).catch(shouldNever('upsert 1 existing fail'));
        },
        // TODO: Upsert array[2] new
        // TODO: Upsert array[2] existing
        // TODO: Upsert array[2] new & existing
        // Remove 1
        function(){
            return Log.remove({ id:4 })
                .then(function(entity){
                    test.deepEqual(entity, { id: 4, level: 2, title: 'fourth' }); // full entity returned
                    test.deepEqual(driver._storage.length, 3);
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeRemove:1,
                        beforeLoading:1,
                        afterLoading:1,
                        afterRemove:1
                    });
                }).catch(shouldNever('remove 1 fail'));
        },
        // Remove non-existing
        function(){
            return Log.remove({ id: 100 })
                .then(shouldNever('remove non-existing success'))
                .catch(function(e){
                    test.equal(driver._storage.length, 3); // length not changed
                    test.ok(e instanceof errors.EntityNotFound); // error ok
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeRemove:1
                        // no more hooks due to error
                    });
                });
        },

        // STORAGE CONSISTENCY TEST
        function(){
            test.deepEqual(driver._storage, [
                { id: 1, level: 0, title: 'first', tags: ['a','b','c'] },
                { id: 2, level: 0, title: 'Second', entry: {a:1,b:2,c:3,d:4} },
                { id: 3, level: 1, title: 'Third' }
            ]);
        },

        // get(): by object
        function(){
            return Log.get({id:1})
                .then(function(entity){
                    test.deepEqual(entity, { id: 1, level: 0, title: 'first', tags: ['a','b','c'] });
                    testHooks.Log.fired({
                        beforeFindOne:1,
                        beforeLoading:1,
                        afterLoading:1,
                        afterFindOne:1
                    });
                })
                .catch(shouldNever('get() fail'));
        },
        // get(): by array
        function(){
            return Log.get(1)
                .then(function(entity){
                    test.deepEqual(entity, { id: 1, level: 0, title: 'first', tags: ['a','b','c'] });
                    testHooks.Log.fired({
                        beforeFindOne:1,
                        beforeLoading:1,
                        afterLoading:1,
                        afterFindOne:1
                    });
                })
                .catch(shouldNever('get() fail'));
        },
        // get(): not found
        function(){
            return Log.get({id:100})
                .then(function(entity){
                    test.equal(entity, null);
                    testHooks.Log.fired({
                        beforeFindOne:1,
                        // no loading: null
                        afterFindOne:1
                    });
                })
                .catch(shouldNever('get() fail'));
        },
        // get(): wrong PK
        function(){
            return Q.all([
                Log.get({a:1,b:2})
                    .then(shouldNever('get() wrong PK success (1)'))
                    .catch(function(e){
                        test.ok(e instanceof errors.MissyModelError);
                        testHooks.Log.fired({}); // none
                    }),
                Log.get([])
                    .then(shouldNever('get() wrong PK success (2)'))
                    .catch(function(e){
                        test.ok(e instanceof errors.MissyModelError);
                        testHooks.Log.fired({}); // none
                    }),
                Log.get([1,2])
                    .then(shouldNever('get() wrong PK success (3)'))
                    .catch(function(e){
                        test.ok(e instanceof errors.MissyModelError);
                        testHooks.Log.fired({}); // none
                    })
            ]);
        },

        // findOne() conditions
        function(){
            return Log.findOne(
                    { id: { $gt: 1 }, level: { $lte: 1 }, title: { $exists: true } },
                    { id: 1, level: 1, title: 1 }, // project
                    { id: -1 } // `id` DESC
                ) // 2 rows found
                .then(function(entity){
                    test.deepEqual(entity, { id: 3, level: 1, title: 'Third' });
                    testHooks.Log.fired({
                        beforeFindOne: 1,
                        afterFindOne: 1,
                        beforeLoading: 1,
                        afterLoading: 1
                    });
                })
                .catch(shouldNever('findOne() conditions fail'));
        }

        // TODO: find()
        // TODO: count()
    ].reduce(Q.when, Q(1))
        .catch(shouldNever('Test error'))
        .then(function(){
            test.done();
        }).done();
};
