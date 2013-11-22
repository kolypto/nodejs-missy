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
                    test.deepEqual(driver._storage.slice(1), entities);
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
                    test.equal(driver._storage.length, 3);
                    test.ok(e instanceof errors.EntityExists);
                    testHooks.Log.fired({
                        beforeSaving:1,
                        afterSaving:1,
                        beforeInsert:1
                        // no more hooks due to error
                    });
                });
        }
    ].reduce(Q.when, Q(1))
        .catch(shouldNever('Test error'))
        .then(function(){
            test.done();
        }).done();

    return;

    //region Insert

    Q()
        .then(function(){
            Log.insert({ id: 1, level: 0, title: 'first', tags: ['a','b','c'] });
        })

    Log.insert({ id: 1, level: 0, title: 'first', tags: ['a','b','c'] });
    Log.insert([
        { id: '2', level: '0', title: 'second', entry: {a:1,b:2,c:3} },
        { id: 3, level: 1, title: 'third' }
    ]);

    test.deepEqual(driver._storage, [
        { id: 1, level: 0, title: 'first', tags: ['a','b','c'] },
        { id: 2, level: 0, title: 'second', entry: {a:1,b:2,c:3} },
        { id: 3, level: 1, title: 'third' }
    ]);

    //endregion

    test.done();
};
