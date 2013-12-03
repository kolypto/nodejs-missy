'use strict';

var Q = require('q'),
    _ = require('lodash'),
    Schema = require('../lib').Schema,
    MemoryDriver = require('../lib').drivers.memory,
    errors = require('../lib/errors'),
    common = require('./common')
    ;

Q.longStackSupport = true;

/** Test automatic driver init
 * @param {test|assert} test
 */
exports.testAutoDriver = function(test){
    var schema = new Schema('memory', {});
    test.ok(schema.driver instanceof MemoryDriver);
    test.done();
};

/** Test driver connections (with queryWhenConnected=false)
 * @param {test|assert} test
 */
exports.testDriverConnections = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {})
        ;

    var User = schema.define('User', {
        id: Number,
        name: String
    });

    // Helpers
    var shouldNever = function(title){
        return function(e){
            test.ok(false, 'Should never get here: ' + title, arguments);
            if (e && e instanceof Error)
                console.error(e.stack);
        };
    };

    var firedEvents = {
        connect: 0,
        disconnect: 0
    };
    schema.driver.on('connect', function(){ firedEvents.connect++; });
    schema.driver.on('disconnect', function(){ firedEvents.disconnect++; });

    return [
        // Schema is not initially connected
        function(){
            return User.find()
                .then(shouldNever('Schema is not initially connected'))
                .catch(function(e){
                    test.ok(e instanceof errors.MissyDriverError);
                });
        },
        // Connect schema
        function(){
            return schema.connect();
        },
        // Schema is connected
        function(){
            test.deepEqual(firedEvents, { connect: 1, disconnect: 0 });
            return User.find()
                .catch(shouldNever('Schema is connected'))
                .then(function(entities){
                    test.deepEqual(entities, []);
                });
        },
        // Simulate a disconnect
        function(){
            schema.driver.emit('disconnect', schema.driver);
            return Q.delay(100); // let it reconnect
        },
        // Schema is reconnected
        function(){
            test.strictEqual(schema.driver.connected, true);
            test.deepEqual(firedEvents, { connect: 2, disconnect: 1 });

            return User.find()
                .catch(shouldNever('Schema is reconnected'))
                .then(function(entities){
                    test.deepEqual(entities, []);
                });
        },
        // Disconnect schema
        function(){
            return schema.disconnect();
        },
        // Schema is disconnected again
        function(){
            test.strictEqual(schema.driver.connected, false);
            test.deepEqual(firedEvents, { connect: 2, disconnect: 2 });
        }
    ].reduce(Q.when, Q())
        .catch(shouldNever('Test error'))
        .finally(function(){
            test.done();
        }).done();
};


/** Test driver connections (with queryWhenConnected=false)
 * @param {test|assert} test
 */
exports.testDriverConnections_queryWhenConnected = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, { queryWhenConnected: true })
        ;

    var User = schema.define('User', {
        id: Number,
        name: String
    });

    // Helpers
    var shouldNever = common.shouldNeverFunc(test);

    var queryMade = false;

    return [
        // Query is delayed
        function(){
            User.find()
                .then(function(){
                    queryMade = true;
                })
                .catch(shouldNever('Query is delayed'));
            return Q().delay(100);
        },
        // Query is not executed _NOW_
        function(){
            test.strictEqual(queryMade, false);
        },
        // Let's connect
        function(){
            return schema.connect();
        },
        // Query done
        function(){
            return Q().delay(100)
                .then(function(){
                    test.strictEqual(queryMade, true);
                });
        }
    ].reduce(Q.when, Q())
        .finally(function(){
            test.done();
        }).done();
};
