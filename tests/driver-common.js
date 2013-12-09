'use strict';

var Q = require('q'),
    _ = require('lodash'),
    missy = require('../'),
    u = require('./common')
    ;

/** Default tests for Missy drivers
 * @fileOverview
 */

/** Common tests for drivers
 * @param {test|assert} test
 * @param {Schema} schema
 * @returns {{ User: Model, tests: Object.<String, function():Q> }}
 */
exports.commonDriverTest = function(test, schema){

    var User = schema.define('User', {
        _id: Number,
        login: String,
        roles: Array,
        age: Number
    }, { pk: '_id', table: '__test_users' });

    var shouldNever = u.shouldNeverFunc(test);

    var tests = {
        // insert()
        'insert()': function(){
            return User.insert([
                    { _id: 1, login: 'a', roles: ['admin', 'user'] },
                    { _id: 2, login: 'b', roles: ['user'] },
                ])
                .then(function(entities){
                    test.equal(entities.length, 2);
                    test.deepEqual(entities[0], { _id: 1, login: 'a', roles: ['admin', 'user'] });
                    test.deepEqual(entities[1], { _id: 2, login: 'b', roles: ['user'] });
                })
        },
        // insert(), existing
        'insert(), existing': function(){
            return User.insert({ _id: 2 })
                .then(shouldNever('insert(): existing'))
                .catch(function(e){
                    test.ok(e instanceof missy.errors.EntityExists);
                });
        },
        // save(): insert
        'save(): insert': function(){
            return User.save({ _id:3, login: 'd', roles: ['guest'] })
                .catch(shouldNever('save(): insert'))
                .then(function(entity){
                    test.deepEqual(entity, { _id:3, login: 'd', roles: ['guest'] });
                });
        },
        // save(): replace
        'save(): replace': function(){
            return User.save({ _id:3, login: 'd', roles: ['guest', 'registered'] })
                .catch(shouldNever('save(): replace'))
                .then(function(entity){
                    test.deepEqual(entity, { _id:3, login: 'd', roles: ['guest', 'registered'] });
                });
        },
        // update(), existing
        'update(), existing': function(){
            return User.update({ _id:3, login: 'd', roles: ['guest'] })
                .catch(shouldNever('update(), existing'))
                .then(function(entity){
                    test.deepEqual(entity, { _id:3, login: 'd', roles: ['guest'] });
                });
        },
        // update(), missing
        'update(), missing': function(){
            return User.update({ _id:4 })
                .then(shouldNever('update(), missing'))
                .catch(function(e){
                    test.ok(e instanceof missy.errors.EntityNotFound)
                });
        },
        // findOne(), existing
        'findOne(), existing': function(){
            return User.findOne({ login: 'd' }, { roles: 0 })
                .catch(shouldNever('findOne(), existing'))
                .then(function(entity){
                    test.deepEqual(entity, { _id:3, login: 'd' });
                });
        },
        // findOne(), missing
        'findOne(), missing': function(){
            return User.findOne({ login: '!!!' })
                .catch(shouldNever('findOne(), missing'))
                .then(function(entity){
                    test.strictEqual(entity, null);
                });
        },
        // find(): projection, sort
        'find(): projection, sort': function(){
            return User.find({ _id: { $gte: 2 } }, { roles: 0 }, { _id: -1 })
                .catch(shouldNever('find(): projection, sort'))
                .then(function(entities){
                    test.equal(entities.length, 2);
                    test.deepEqual(entities[0], { _id: 3, login: 'd' });
                    test.deepEqual(entities[1], { _id: 2, login: 'b' });
                });
        },
        // find(): skip, limit
        'find(): skip, limit': function(){
            return User.skip(1).limit(2).find({}, { roles: 0 }, { _id: 1 })
                .catch(shouldNever('find(): skip, limit'))
                .then(function(entities){
                    test.equal(entities.length, 2);
                    test.deepEqual(entities[0], { _id: 2, login: 'b' });
                    test.deepEqual(entities[1], { _id: 3, login: 'd' });
                });
        },
        // count()
        'count()': function(){
            return User.count({ _id: { $gte: 2 } })
                .catch(shouldNever('count()'))
                .then(function(n){
                    test.strictEqual(n, 2);
                })
        },
        // remove(), missing
        'remove(), missing': function(){
            return User.remove({ _id: '!!!' })
                .then(shouldNever('remove(): missing'))
                .catch(function(e){
                    test.ok(e instanceof missy.errors.EntityNotFound);
                });
        },
        // remove(), existing
        'remove(), existing': function(){
            return User.remove({ _id: '3' })
                .catch(shouldNever('remove(), existing'))
                .then(function(entity){
                    test.deepEqual(entity, { _id: 3, login: 'd', roles: ['guest'] });
                });
        },
        // updateQuery(): upsert=false, multi=true, existing
        'updateQuery(): upsert=false, multi=true, existing': function(){
            return User.updateQuery({ _id: { $gte: 0 } }, { $inc: { age: 10 } }, { /* upsert: false */ multi: true })
                .catch(shouldNever('updateQuery(): upsert=false, multi=true, existing'))
                .then(function(entities){
                    test.ok(_.isArray(entities));
                    test.equal(entities.length, 2);
                    test.deepEqual(entities[0], { _id: 1, login: 'a', roles: ['admin', 'user'], age: 10 });
                    test.deepEqual(entities[1], { _id: 2, login: 'b', roles: ['user'], age: 10 });
                });
        },
        // updateQuery(): upsert=false, multi=false, existing
        'updateQuery(): upsert=false, multi=false, existing': function(){
            return User.updateQuery({ _id: { $gte: 0 } }, { $inc: { age: 1 } }, { /* upsert: false */ /* multi: false */ })
                .catch(shouldNever('updateQuery(): upsert=false, multi=false, existing'))
                .then(function(entity){
                    test.ok(!_.isArray(entity));
                    test.deepEqual(entity, { _id: 1, login: 'a', roles: ['admin', 'user'], age: 11 });
                });
        },
        // updateQuery(): upsert=false, multi=false, missing
        'updateQuery(): upsert=false, multi=false, missing': function(){
            return User.updateQuery({ _id: '!!!' }, { $inc: { age: 1 } }, { /* upsert: false */ /* multi: false */ })
                .catch(shouldNever('updateQuery(): upsert=false, multi=false, missing'))
                .then(function(entity){
                    test.ok(!_.isArray(entity));
                    test.strictEqual(entity, null);
                });
        },
        // updateQuery(): upsert=true, existing
        'updateQuery(): upsert=true, existing': function(){
            return User.updateQuery({ _id: 2 }, { $inc: { age: 2 } }, { upsert: true /* multi: false */ })
                .catch(shouldNever('updateQuery(): upsert=true, existing'))
                .then(function(entity){
                    test.deepEqual(entity, { _id: 2, login: 'b', roles: ['user'], age: 12 });
                });
        },
        // updateQuery(): upsert=true, missing
        'updateQuery(): upsert=true, missing': function(){
            return User.updateQuery({ _id: 3 }, { login: 'c', $inc: { age: 2 } }, { upsert: true /* multi: false */ })
                .catch(shouldNever('updateQuery(): upsert=true, missing'))
                .then(function(entity){
                    test.deepEqual(entity, { _id: 3, login: 'c', age: 2 });
                });
        },
        // removeQuery(): multi=false, existing
        'removeQuery(): multi=false, existing': function(){
            return User.removeQuery({ login: 'c' }, { multi: false })
                .catch(shouldNever('removeQuery(): multi=false, existing'))
                .then(function(entity){
                    test.deepEqual(entity, { _id: 3, login: 'c', age: 2 });
                });
        },
        // removeQuery(): multi=false, missing
        'removeQuery(): multi=false, missing': function(){
            return User.removeQuery({ login: 'c' }, { multi: false })
                .catch(shouldNever('removeQuery(): multi=false, missing'))
                .then(function(entity){
                    test.strictEqual(entity, null);
                });
        },
        // removeQuery(), multi=true
        'removeQuery(): multi=true': function(){
            return User.removeQuery({ login: { $in: ['a', 'b'] } }, { /* multi: true */ })
                .catch(shouldNever('removeQuery(): multi=true'))
                .then(function(entities){
                    test.ok(_.isArray(entities));
                    test.equal(entities.length, 2);
                    test.deepEqual(entities[0], { _id: 1, login: 'a', roles: ['admin', 'user'], age: 11 });
                    test.deepEqual(entities[1], { _id: 2, login: 'b', roles: ['user'], age: 12 });
                });
        },
        // Final consistency test
        'Final consistency test': function(){
            return User.count()
                .catch(shouldNever('Final consistency test'))
                .then(function(n){
                    test.equal(n, 0);
                });
        }
    };

    return {
        User: User,
        tests: tests
    };
};
