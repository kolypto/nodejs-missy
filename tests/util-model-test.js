'use strict';

var Q = require('q'),
    _ = require('lodash'),
    Schema = require('../lib').Schema,
    MemoryDriver = require('../lib').drivers.MemoryDriver,
    modelUtil = require('../lib/util/model'),
    types = require('../lib/types'),
    errors = require('../lib/errors')
    ;

/** Test {util.model.Converter}
 * @param {test|assert} test
 */
exports.testConverter = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {});

    // Define a custom type handler
    function SmileTypeHandler(schema, name){
        return {
            norm: function(value, field){ return value + ' :)'; },
            load: function(value, field){ return value; },
            save: function(value, field){ return value + ' :)'; }
        };
    }
    schema.registerType('smile', SmileTypeHandler);

    // Create the models
    var User = schema.define('User', {
        id: Number,
        name: String,
        login: { type: 'string', required: true },
        ctime: { type: 'date', required: true, def: function(){ return new Date(); } },
        obj: Object,
        roles: Array,
        json: { type: 'json' },
        any: undefined,
        smile: { type: 'smile' }
    }, {
        // table: 'users'
        // pk: 'id'
    });

    var Profile = schema.define('Profile', {
        user_id: Number,
        name: String,
        data: Object
    }, {
        table: 'user_profiles',
        pk: ['user_id', 'name'],
        required: true
    });

    // Check whether the models are defined correctly
    test.ok(User.schema === schema);
    test.equal(User.name, 'User');
    test.deepEqual(User.options, {
        table: 'users', // generated: lowercase + plural
        pk: [ 'id' ], // default
        required: false, // default
        hooks: {}  // default
    });
    test.deepEqual(Object.keys(User.fields), ['id','name','login','ctime','obj','roles','json','any', 'smile']);
    test.deepEqual(User.fields.id, { name: 'id', type: 'number', required: false, _model: User, _typeHandler: schema.types['number'] });
    test.deepEqual(User.fields.name, { name: 'name', type: 'string', required: false, _model: User, _typeHandler: schema.types['string'] });
    test.deepEqual(User.fields.login, { name: 'login', type: 'string', required: true, _model: User, _typeHandler: schema.types['string'] });
    test.deepEqual(_.omit(User.fields.ctime, 'def'), { name: 'ctime', type: 'date', required: true, _model: User, _typeHandler: schema.types['date'] });
    test.ok(_.isFunction(User.fields.ctime.def().getMonth)); // def works
    test.deepEqual(User.fields.obj, { name: 'obj', type: 'object', required: false, _model: User, _typeHandler: schema.types['object'] });
    test.deepEqual(User.fields.roles, { name: 'roles', type: 'array', required: false, _model: User, _typeHandler: schema.types['array'] });
    test.deepEqual(User.fields.json, { name: 'json', type: 'json', required: false, _model: User, _typeHandler: schema.types['json'] });
    test.deepEqual(User.fields.any, { name: 'any', type: 'any', required: false, _model: User, _typeHandler: schema.types['any'] });
    test.deepEqual(User.fields.smile, { name: 'smile', type: 'smile', required: false, _model: User, _typeHandler: schema.types['smile'] });

    test.ok(Profile.schema === schema);
    test.equal(Profile.name, 'Profile');
    test.deepEqual(Profile.options, {
        table: 'user_profiles', // override
        pk: [ 'user_id', 'name' ], // override
        required: true, // override
        hooks: {}  // default
    });

    // Test converter: Load
    test.deepEqual(User.entityLoading({  }), {  }); // empty object ok

    test.deepEqual(User.entityLoading({ aaaaa: {a:1} }), { aaaaa: {a:1} }); // custom properties ok

    test.deepEqual(User.entityLoading({ id: 0.1 }), { id: 0.1 }); // number convertion
    test.deepEqual(User.entityLoading({ id: '0' }), { id: 0 }); // number convertion

    test.deepEqual(User.entityLoading({ name: '1' }), { name: '1' }); // string convertion
    test.deepEqual(User.entityLoading({ name: [1,2,3] }), { name: '1,2,3' }); // string convertion

    test.deepEqual(User.entityLoading({ login: undefined }), { login: '' }); // forced string convertion
    test.deepEqual(User.entityLoading({ login: null }), { login: '' }); // forced string convertion
    test.deepEqual(User.entityLoading({ login: 'kolypto' }), { login: 'kolypto' }); // ok string convertion

    var now = new Date();
    test.deepEqual(User.entityLoading({ ctime: undefined }).ctime.getMonth(), now.getMonth()); // default
    test.deepEqual(User.entityLoading({ ctime: now }), { ctime: now }); // ok
    test.deepEqual(User.entityLoading({ ctime: 1000 }), { ctime: new Date('Thu Jan 01 1970 02:00:01 GMT+0200 (EET)') }); // converted
    test.deepEqual(User.entityLoading({ ctime: '2012-03-04 15:16:17' }), { ctime: new Date('Sun Mar 04 2012 15:16:17 GMT+0200 (EET)') }); // converted

    test.deepEqual(User.entityLoading({ obj: undefined }), { obj: null }); // not required, goes NULL
    test.deepEqual(User.entityLoading({ obj: 1 }), { obj: null }); // not required, goes NULL
    test.deepEqual(User.entityLoading({ obj: {a:1} }), { obj: {a:1} }); // ok
    test.deepEqual(User.entityLoading({ obj: [1,2,3] }), { obj: [1,2,3] }); // an array is also an object

    test.deepEqual(User.entityLoading({ roles: undefined }), { roles: null }); // wrong, null
    test.deepEqual(User.entityLoading({ roles: 1 }), { roles: [1] }); // converted
    test.deepEqual(User.entityLoading({ roles: [1] }), { roles: [1] }); // ok

    test.deepEqual(User.entityLoading({ json: undefined }), { json: undefined }); // ok, as it's converted to 'undefined'
    test.deepEqual(User.entityLoading({ json: null }), { json: null }); // ok, converted
    test.deepEqual(User.entityLoading({ json: 1 }), { json: 1 }); // ok
    test.deepEqual(User.entityLoading({ json: '1' }), { json: 1 }); // ok
    test.deepEqual(User.entityLoading({ json: '{"a":1}' }), { json: {a:1} }); // ok
    test.throws(function(){
        User.entityLoading({ json: '{"a":1--}' }); // parse error
    }, errors.MissyTypeError);

    test.deepEqual(User.entityLoading({ any: [1,{a:1}] }), { any: [1,{a:1}] }); // ok

    test.deepEqual(User.entityLoading({ smile: 123 }), { smile: 123 }); // ok

    // Test converter: Save
    test.deepEqual(User.entitySaving({  }), {  }); // empty object ok

    test.deepEqual(User.entitySaving({ aaaaa: {a:1} }), { aaaaa: {a:1} }); // custom properties ok

    test.deepEqual(User.entitySaving({ id: 0.1 }), { id: 0.1 }); // number convertion
    test.deepEqual(User.entitySaving({ id: '0' }), { id: 0 }); // number convertion

    test.deepEqual(User.entitySaving({ name: '1' }), { name: '1' }); // string convertion
    test.deepEqual(User.entitySaving({ name: [1,2,3] }), { name: '1,2,3' }); // string convertion

    test.deepEqual(User.entitySaving({ login: undefined }), { login: '' }); // forced string convertion
    test.deepEqual(User.entitySaving({ login: null }), { login: '' }); // forced string convertion
    test.deepEqual(User.entitySaving({ login: 'kolypto' }), { login: 'kolypto' }); // ok string convertion

    var now = new Date();
    test.deepEqual(User.entitySaving({ ctime: undefined }).ctime.getMonth(), now.getMonth()); // default
    test.deepEqual(User.entitySaving({ ctime: now }), { ctime: now }); // ok
    test.deepEqual(User.entitySaving({ ctime: 1000 }), { ctime: new Date('Thu Jan 01 1970 02:00:01 GMT+0200 (EET)') }); // converted
    test.deepEqual(User.entitySaving({ ctime: '2012-03-04 15:16:17' }), { ctime: new Date('Sun Mar 04 2012 15:16:17 GMT+0200 (EET)') }); // converted

    test.deepEqual(User.entitySaving({ obj: undefined }), { obj: null }); // not required, goes NULL
    test.deepEqual(User.entitySaving({ obj: 1 }), { obj: null }); // not required, goes NULL
    test.deepEqual(User.entitySaving({ obj: {a:1} }), { obj: {a:1} }); // ok
    test.deepEqual(User.entitySaving({ obj: [1,2,3] }), { obj: [1,2,3] }); // an array is also an object

    test.deepEqual(User.entitySaving({ roles: undefined }), { roles: null }); // wrong, null
    test.deepEqual(User.entitySaving({ roles: 1 }), { roles: [1] }); // converted
    test.deepEqual(User.entitySaving({ roles: [1] }), { roles: [1] }); // ok

    test.deepEqual(User.entitySaving({ json: undefined }), { json: null }); // not ok: no `undefined` in JSON
    test.deepEqual(User.entitySaving({ json: null }), { json: null }); // ok, as not required
    test.deepEqual(User.entitySaving({ json: 1 }), { json: '1' }); // ok
    test.deepEqual(User.entitySaving({ json: '1' }), { json: '"1"' }); // ok
    test.deepEqual(User.entitySaving({ json: {a:1} }), { json: '{"a":1}' }); // ok

    test.deepEqual(User.entitySaving({ any: [1,{a:1}] }), { any: [1,{a:1}] }); // ok

    test.deepEqual(User.entitySaving({ smile: 123 }), { smile: '123 :)' }); // overwritten

    
    test.done();
};



/** Test MissyProjection
 * @param {test|assert} test
 */
exports.testMissyProjection = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {});

    var Profile = schema.define('Profile', {
        user_id: Number,
        name: String,
        data: Object
    }, {
        table: 'user_profiles',
        pk: ['user_id', 'name'],
        required: true
    });

    var p;

    // Empty values
    test.deepEqual(new modelUtil.MissyProjection(), { projection: {}, inclusionMode: false });
    test.deepEqual(new modelUtil.MissyProjection({}), { projection: {}, inclusionMode: false });
    test.deepEqual(new modelUtil.MissyProjection(''), { projection: {}, inclusionMode: false });
    test.deepEqual(new modelUtil.MissyProjection([]), { projection: {}, inclusionMode: false });

    // Array syntax
    test.deepEqual(
        new modelUtil.MissyProjection(['a','b','c']),
        { projection: { a:1, b:1, c:1 }, inclusionMode: true }
    );

    // Object: inclusion
    p = new modelUtil.MissyProjection({ a:1, b:1, c:1 });
    test.deepEqual(p, { projection: { a:1, b:1, c:1 }, inclusionMode: true });

    // Object: exclusion
    p = new modelUtil.MissyProjection({ a:0, b:0, c:0 });
    test.deepEqual(p, { projection: { a:0, b:0, c:0 }, inclusionMode: false });

    // getFieldDetails() when empty
    p = new modelUtil.MissyProjection();
    test.deepEqual(p.getFieldDetails(Profile), {
        fields: ['user_id', 'name', 'data'],
        pick: ['user_id', 'name', 'data'],
        omit: []
    });

    // getFieldDetails() in inclusion mode
    p = new modelUtil.MissyProjection({ name: 1, aaaaa: 1 });
    test.deepEqual(p.getFieldDetails(Profile), {
        fields: ['name', 'aaaaa'],
        pick: ['name', 'aaaaa'],
        omit: []
    });

    // getFieldDetails() in exclusion mode
    p = new modelUtil.MissyProjection({ name: 0, aaaaa: 0 });
    test.deepEqual(p.getFieldDetails(Profile), {
        fields: ['user_id', 'data'],
        pick: [],
        omit: ['name', 'aaaaa']
    });

    // Self proxy
    p = new modelUtil.MissyProjection({ a:0, b:0, c:0 });
    p = new modelUtil.MissyProjection(p);
    test.deepEqual(p, { projection: { a:0, b:0, c:0 }, inclusionMode: false });

    test.done();
};



/** Test MissyCriteria
 * @param {test|assert} test
 */
exports.testMissyCriteria = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {});

    var Profile = schema.define('Page', {
        category: String,
        id: Number,
        title: String,
        tags: Array
    }, { pk: ['category', 'id'] });

    var c;

    // Empty & wrong
    c = new modelUtil.MissyCriteria(Profile);
    test.deepEqual(_.omit(c, 'model'), { criteria: {} });

    c = new modelUtil.MissyCriteria(Profile, null);
    test.deepEqual(_.omit(c, 'model'), { criteria: {} });

    c = new modelUtil.MissyCriteria(Profile, undefined);
    test.deepEqual(_.omit(c, 'model'), { criteria: {} });

    c = new modelUtil.MissyCriteria(Profile, 1);
    test.deepEqual(_.omit(c, 'model'), { criteria: {} });

    // Ok & convertion
    c = new modelUtil.MissyCriteria(Profile, { user_id: '1', title: 1, tags: 'a', aaaaa: 1 });
    test.deepEqual(_.omit(c, 'model'), { criteria: {
        user_id: { $eq: 1 }, // converted
        title: { $eq: '1' }, // converted
        tags: { $eq: ['a'] }, // converted
        aaaaa: { $eq: 1 } // custom property unchanged
    } });

    c = new modelUtil.MissyCriteria(Profile, {
        user_id: { $exists: true },
        title: { $ne: 0 },
        aaaaa: { $in: ['public', 1] }
    });
    test.deepEqual(_.omit(c, 'model'), { criteria: {
        user_id: { $exists: true },
        title: { $ne: '0' },
        aaaaa: { $in: ['public', '1'] }
    } });

    // Unknown operator
    test.throws(function(){
        new modelUtil.MissyCriteria(Profile, { anything: { $wrong: 1 } });
    }, errors.MissyModelError);

    test.done();
};



/** Test MissySort
 * @param {test|assert} test
 */
exports.testMissySort = function(test){
    var s;

    // Empty
    s = new modelUtil.MissySort();
    test.deepEqual(s, { sort: {} });

    s = new modelUtil.MissySort(undefined);
    test.deepEqual(s, { sort: {} });

    s = new modelUtil.MissySort(null);
    test.deepEqual(s, { sort: {} });

    s = new modelUtil.MissySort('');
    test.deepEqual(s, { sort: {} });

    s = new modelUtil.MissySort([]);
    test.deepEqual(s, { sort: {} });

    s = new modelUtil.MissySort({});
    test.deepEqual(s, { sort: {} });

    // String syntax
    s = new modelUtil.MissySort('a,b+,c-');
    test.deepEqual(s, { sort: { a:1, b:1, c:-1 } });

    // Array syntax
    s = new modelUtil.MissySort(['a','b+', 'c-']);
    test.deepEqual(s, { sort: { a:1, b:1, c:-1 } });

    // Object syntax
    s = new modelUtil.MissySort({ a:1,b:-1,c:0,d:2 });
    test.deepEqual(s, { sort: { a:1, b:-1, c:-1, d:1 } });

    test.done();
};
