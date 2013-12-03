'use strict';

var Q = require('q'),
    _ = require('lodash'),
    Schema = require('../lib').Schema,
    MemoryDriver = require('../lib').drivers.memory,
    errors = require('../lib/errors'),
    common = require('./common')
    ;

Q.longStackSupport = true;

/** Test Model on MemoryDriver
 * @param {test|assert} test
 */
exports.testModel_MemoryDriver = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {})
        ;

    schema.connect(); // just ignore the result

    // Model
    var Log = schema.define('Log', {
        id: Number,
        level: { type: 'number', required: true },
        title: String,
        tags: Array,
        entry: 'object' // string type
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
    var shouldNever = common.shouldNeverFunc(test);

    // Test
    [
        // Model.options.entityPrototype
        function(){
            var Test = schema.define('Test', {
                id: Number,
                title: String
            }, {
                entityPrototype: {
                    getTitle: function(){
                        return this.title;
                    }
                }
            });

            return Q()
                .then(function(){
                    return Test.save({ id:1, title: 'Test' });
                })
                .then(function(){
                    return Test.findOne({id:1});
                })
                .then(function(entity){
                    test.equal(entity.getTitle(), 'Test');
                });
        },
        // Insert 1
        function(){
            return Log.insert({ id: 1, level: 0, title: 'first', tags: ['a','b','c'] })
                .then(function(entity){
                    test.deepEqual(entity, { id: 1, level: 0, title: 'first', tags: ['a','b','c'] });
                    test.deepEqual(driver.getTable(Log).slice(0), [ entity ]);
                    testHooks.Log.fired({
                        beforeExport:1,
                        afterExport:1,
                        beforeInsert:1,
                        beforeImport:1,
                        afterImport:1,
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
                    test.deepEqual(driver.getTable(Log).slice(1), entities); // inserted
                    testHooks.Log.fired({
                        beforeExport:2,
                        afterExport:2,
                        beforeInsert:1,
                        beforeImport:2,
                        afterImport:2,
                        afterInsert:1
                    });
                }).catch(shouldNever('insert array[2] fail'));
        },
        // Insert non-unique: fail
        function(){
            return Log.insert({ id: 1 })
                .then(shouldNever('insert non-unique success'))
                .catch(function(e){
                    test.equal(driver.getTable(Log).length, 3); // length not changed
                    test.ok(e instanceof errors.EntityExists); // error ok
                    testHooks.Log.fired({
                        beforeExport:1,
                        afterExport:1,
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
                    test.deepEqual(driver.getTable(Log).slice(0,1), [ entity ]); // replaced
                    testHooks.Log.fired({
                        beforeExport:1,
                        afterExport:1,
                        beforeUpdate:1,
                        beforeImport:1,
                        afterImport:1,
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
                    test.deepEqual(driver.getTable(Log).slice(1), entities); // inserted
                    testHooks.Log.fired({
                        beforeExport:2,
                        afterExport:2,
                        beforeUpdate:1,
                        beforeImport:2,
                        afterImport:2,
                        afterUpdate:1
                    });
                }).catch(shouldNever('update array[2] fail'));
        },
        // Update non-existing
        function(){
            return Log.update({ id: 100 })
                .then(shouldNever('update non-existing success'))
                .catch(function(e){
                    test.equal(driver.getTable(Log).length, 3); // length not changed
                    test.ok(e instanceof errors.EntityNotFound); // error ok
                    testHooks.Log.fired({
                        beforeExport:1,
                        afterExport:1,
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
                    test.deepEqual(driver.getTable(Log).slice(3), [ entity ]);
                    testHooks.Log.fired({
                        beforeExport:1,
                        afterExport:1,
                        beforeSave:1,
                        beforeImport:1,
                        afterImport:1,
                        afterSave:1
                    });
                }).catch(shouldNever('save 1 new fail'));
        },
        // Save 1 existing
        function(){
            return Log.save({ id: 1, level: 0, title: 'first', tags: ['a','b','c'] })
                .then(function(entity){
                    test.deepEqual(entity, { id: 1, level: 0, title: 'first', tags: ['a','b','c'] });
                    test.deepEqual(driver.getTable(Log).slice(0,1), [ entity ]);
                    testHooks.Log.fired({
                        beforeExport:1,
                        afterExport:1,
                        beforeSave:1,
                        beforeImport:1,
                        afterImport:1,
                        afterSave:1
                    });
                }).catch(shouldNever('save 1 existing fail'));
        },
        // TODO: Save array[2] new
        // TODO: Save array[2] existing
        // TODO: Save array[2] new & existing
        // Remove 1
        function(){
            return Log.remove({ id:4 })
                .then(function(entity){
                    test.deepEqual(entity, { id: 4, level: 2, title: 'fourth' }); // full entity returned
                    test.deepEqual(driver.getTable(Log).length, 3);
                    testHooks.Log.fired({
                        beforeRemove:1,
                        beforeImport:1,
                        afterImport:1,
                        afterRemove:1
                    });
                }).catch(shouldNever('remove 1 fail'));
        },
        // Remove non-existing
        function(){
            return Log.remove({ id: 100 })
                .then(shouldNever('remove non-existing success'))
                .catch(function(e){
                    test.equal(driver.getTable(Log).length, 3); // length not changed
                    test.ok(e instanceof errors.EntityNotFound); // error ok
                    testHooks.Log.fired({
                        beforeRemove:1
                        // no more hooks due to error
                    });
                });
        },

        // STORAGE CONSISTENCY TEST
        function(){
            test.deepEqual(driver.getTable(Log), [
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
                        beforeImport:1,
                        afterImport:1,
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
                        beforeImport:1,
                        afterImport:1,
                        afterFindOne:1
                    });
                })
                .catch(shouldNever('get() fail'));
        },
        // get(): not found
        function(){
            return Log.get({id:100})
                .then(function(entity){
                    test.strictEqual(entity, null);
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
                        beforeImport: 1,
                        afterImport: 1,
                        afterFindOne: 1
                    });
                })
                .catch(shouldNever('findOne() conditions fail'));
        },
        // TODO: more findOne() tests

        // find()
        function(){
            return Log.find(
                { id: { $gt: 1 }, level: { $lte: 1 }, title: { $exists: true } },
                { id: 1, level: 1 }, // project
                { id: -1 } // `id` DESC
            ) // 2 rows found
                .then(function(entities){
                    test.deepEqual(entities, [
                        { id: 3, level: 1 },
                        { id: 2, level: 0 }
                    ]);
                    testHooks.Log.fired({
                        beforeFind: 1,
                        beforeImport: 2,
                        afterImport: 2,
                        afterFind: 1
                    });
                })
                .catch(shouldNever('find() conditions fail'));
        },
        // find() with limit and exclusive projection
        function(){
            return Log.find(
                {  },
                { entry: 0, tags: 0, title: 0 }, // project
                { id: -1 }, // `id` DESC
                { skip: 1, limit: 1 }
            ) // 1 rows found
                .then(function(entities){
                    test.deepEqual(entities, [
                        { id: 2, level: 0 }
                    ]);
                    testHooks.Log.fired({
                        beforeFind: 1,
                        beforeImport: 1,
                        afterImport: 1,
                        afterFind: 1
                    });
                })
                .catch(shouldNever('find() with limit and exclusive projection fail'));
        },
        // TODO: more find() tests

        // count()
        function(){
            return Log.count(
                { id: { $gt: 1 }, level: { $lte: 1 }, title: { $exists: true } }
            ) // 2 rows found
                .then(function(count){
                    test.equal(count, 2);
                    testHooks.Log.fired({});
                })
                .catch(shouldNever('count()'));
        },

        // updateQuery() upsert=false, existing
        function(){
            return Log.updateQuery(
                    { id: 3, level:1 },
                    { $inc: {level:1}, tags:'changed' }
                )
                .then(function(entity){
                    test.deepEqual(entity, { id: 3, level: 2, title: 'Third', tags:['changed'] });
                    testHooks.Log.fired({
                        beforeUpdateQuery: 1,
                        beforeImport: 1,
                        afterImport: 1,
                        afterUpdateQuery: 1
                    });
                })
                .catch(shouldNever('updateQuery() upsert=false, existing'));
        },
        // updateQuery() upsert=false, missing
        function(){
            return Log.updateQuery(
                { id: 4 },
                { $inc: {level:1}, tags:'changed' }
            )
                .then(shouldNever('updateQuery() upsert=false, missing'))
                .catch(function(e){
                    test.ok(e instanceof errors.EntityNotFound);
                    testHooks.Log.fired({
                        beforeUpdateQuery: 1
                    });
                });
        },

        // updateQuery() upsert=true, existing
        function(){
            return Log.updateQuery(
                { id: 3, level:2 },
                { $inc: {level:-1}, $unset: {tags:''} },
                { upsert: true }
            )
                .then(function(entity){
                    test.deepEqual(entity, { id: 3, level: 1, title: 'Third' });
                    test.deepEqual(entity, driver.getTable(Log)[2]);
                    testHooks.Log.fired({
                        beforeUpdateQuery: 1,
                        beforeImport: 1,
                        afterImport: 1,
                        afterUpdateQuery: 1
                    });
                })
                .catch(shouldNever('updateQuery() upsert=true, existing'));
        },

        // updateQuery() upsert=true, missing
        function(){
            return Log.updateQuery(
                { id: 4, level:1 },
                { $inc: {level:1, hits:1}, title: 'Fourth' },
                { upsert: true }
            )
                .then(function(entity){
                    test.deepEqual(entity, { id: 4, level: 2, title: 'Fourth', hits: 1 });
                    test.deepEqual(entity, driver.getTable(Log)[3]);
                    testHooks.Log.fired({
                        beforeUpdateQuery: 1,
                        beforeImport: 1,
                        afterImport: 1,
                        afterUpdateQuery: 1
                    });
                })
                .catch(shouldNever('updateQuery() upsert=true, missing'));
        },

        // updateQuery() upsert=false, multi=true
        function(){
            return Log.updateQuery(
                { id: { $gt:2 } },
                { hits:2 },
                { multi: true }
            )
                .then(function(entities){
                    test.deepEqual(entities, [
                        { id: 3, level: 1, title: 'Third', hits:2 },
                        { id: 4, level: 2, title: 'Fourth', hits:2 }
                    ]);
                    test.equal(driver.getTable(Log).length, 4);
                    testHooks.Log.fired({
                        beforeUpdateQuery: 1,
                        beforeImport: 2,
                        afterImport: 2,
                        afterUpdateQuery: 1
                    });
                })
                .catch(shouldNever('updateQuery() upsert=true, multi=true'));
        },

        // removeQuery(), no matching entities
        function(){
            return Log.removeQuery({ id: 999 })
                .then(function(entities){
                    test.equal(entities.length, 0);

                    test.equal(driver.getTable(Log).length, 4);
                    testHooks.Log.fired({
                        beforeRemoveQuery: 1,
                        beforeImport: 0,
                        afterImport: 0,
                        afterRemoveQuery: 1
                    });
                })
                .catch(shouldNever('removeQuery(), no matching entities'));
        },
        // removeQuery()
        function(){
            return Log.removeQuery({ id: { $gt: 2 } })
                .then(function(entities){
                    test.equal(entities.length, 2);
                    test.deepEqual(entities[0], { id: 3, level: 1, title: 'Third', hits: 2 });
                    test.deepEqual(entities[1], { id: 4, level: 2, hits: 2, title: 'Fourth' });

                    test.equal(driver.getTable(Log).length, 2);
                    testHooks.Log.fired({
                        beforeRemoveQuery: 1,
                        beforeImport: 2,
                        afterImport: 2,
                        afterRemoveQuery: 1
                    });
                })
                .catch(shouldNever('removeQuery(), no matching entities'));
        },

    ].reduce(Q.when, Q(1))
        .catch(shouldNever('Test error'))
        .finally(function(){
            test.done();
        }).done();
};



/** Test Model entityPrototype
 * @param test
 */
exports.testModel_entityPrototype = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {})
        ;

    schema.connect();

    // Model
    var Wallet = schema.define('Wallet', {
        uid: Number,
        amount: Number,
        currency: String
    }, {
        pk: 'uid',
        entityPrototype: {
            toString: function(){
                return this.amount + ' ' + this.currency;
            }
        }
    });

    // Helpers
    var shouldNever = common.shouldNeverFunc(test);

    // Test
    return [
        // entityImport
        function(){
            return Wallet.entityImport({ uid: 1, amount: 100, currency: 'USD' })
                .then(function(entity){
                    test.deepEqual(entity, { uid: 1, amount: 100, currency: 'USD' });
                    test.equal(entity + '', '100 USD');
                });
        },
        // save()
        function(){
            return Wallet.save({ uid: 1, amount: 100, currency: 'USD' })
                .then(function(entity){
                    test.equal(entity + '', '100 USD');
                });
        },
        // find()
        function(){
            return Wallet.findOne(1, function(entity){
                test.equal(entity + '', '100 USD');
            });
        }
    ].reduce(Q.when, Q(1))
        .catch(shouldNever('Test error'))
        .finally(function(){
            test.done();
        }).done();
};
