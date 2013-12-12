'use strict';

var Q = require('q'),
    _ = require('lodash'),
    Schema = require('../lib').Schema,
    MemoryDriver = require('../lib').drivers.memory,
    u = require('../lib/util'),
    types = require('../lib/types'),
    errors = require('../lib/errors')
    ;

/** Test {util.model.Converter}
 * @param {test|assert} test
 */
exports.testConverter = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {});

    schema.connect(); // just ignore the result

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
        smile: { type: 'smile' },
        enabled: Boolean
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
        entityPrototype: undefined // default
    });
    test.deepEqual(Object.keys(User.fields), ['id','name','login','ctime','obj','roles','json','any', 'smile','enabled']);
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
        entityPrototype: undefined // default
    });

    // Test converter: Load
    var testEntityImport = function(entity, expected){
        User.entityImport(entity)
            .then(function(entity){
                test.deepEqual(entity, expected);
            })
            .catch(function(err){
                test.ok(false);
            }).done();
    };

    testEntityImport({  }, {  }); // empty object ok

    testEntityImport({ aaaaa: {a:1} }, { aaaaa: {a:1} }); // custom properties ok

    testEntityImport({ id: 0.1 }, { id: 0.1 }); // number convertion
    testEntityImport({ id: '0' }, { id: 0 }); // number convertion

    testEntityImport({ name: '1' }, { name: '1' }); // string convertion
    testEntityImport({ name: [1,2,3] }, { name: '1,2,3' }); // string convertion

    testEntityImport({ login: undefined }, { login: '' }); // forced string convertion
    testEntityImport({ login: null }, { login: '' }); // forced string convertion
    testEntityImport({ login: 'kolypto' }, { login: 'kolypto' }); // ok string convertion

    var now = new Date();
    testEntityImport({ ctime: undefined }, { ctime: null }); // ok date

    testEntityImport({ ctime: 1000 }, { ctime: new Date('Thu Jan 01 1970 02:00:01 GMT+0200 (EET)') }); // converted
    testEntityImport({ ctime: '2012-03-04 15:16:17' }, { ctime: new Date('Sun Mar 04 2012 15:16:17 GMT+0200 (EET)') }); // converted

    testEntityImport({ obj: undefined }, { obj: null }); // not required, goes NULL
    testEntityImport({ obj: 1 }, { obj: null }); // not required, goes NULL
    testEntityImport({ obj: {a:1} }, { obj: {a:1} }); // ok
    testEntityImport({ obj: [1,2,3] }, { obj: [1,2,3] }); // an array is also an object

    testEntityImport({ roles: undefined }, { roles: null }); // wrong, null
    testEntityImport({ roles: 1 }, { roles: [1] }); // converted
    testEntityImport({ roles: [1] }, { roles: [1] }); // ok

    testEntityImport({ json: undefined }, { json: undefined }); // ok, as it's converted to 'undefined'
    testEntityImport({ json: null }, { json: null }); // ok, converted
    testEntityImport({ json: 1 }, { json: 1 }); // ok
    testEntityImport({ json: '1' }, { json: 1 }); // ok
    testEntityImport({ json: '{"a":1}' }, { json: {a:1} }); // ok
    User.entityImport({ json: '{"a":1--}' })
        .then(function(){
            test.ok(false);
        })
        .catch(function(e){
            test.ok(e instanceof errors.MissyTypeError);
        });

    testEntityImport({ any: [1,{a:1}] }, { any: [1,{a:1}] }); // ok

    testEntityImport({ smile: 123 }, { smile: 123 }); // ok
    testEntityImport({ enabled: 'true' }, { enabled: true }); // ok
    testEntityImport({ enabled: true }, { enabled: true }); // ok
    testEntityImport({ enabled: 1 }, { enabled: true }); // ok

    // Test converter: Save
    var testEntityExport = function(entity, expected){
        User.entityExport(entity)
            .then(function(entity){
                if (_.isUndefined(expected.ctime))
                    expected.ctime = entity.ctime; // honor the default
                test.deepEqual(entity, expected);
            })
            .catch(function(err){
                test.ok(false);
            }).done();
    };
    testEntityExport({  }, {  }); // empty object ok

    testEntityExport({ aaaaa: {a:1} }, { aaaaa: {a:1} }); // custom properties ok

    testEntityExport({ id: 0.1 }, { id: 0.1 }); // number convertion
    testEntityExport({ id: '0' }, { id: 0 }); // number convertion

    testEntityExport({ name: '1' }, { name: '1' }); // string convertion
    testEntityExport({ name: [1,2,3] }, { name: '1,2,3' }); // string convertion

    testEntityExport({ login: undefined }, { login: '' }); // forced string convertion
    testEntityExport({ login: null }, { login: '' }); // forced string convertion
    testEntityExport({ login: 'kolypto' }, { login: 'kolypto' }); // ok string convertion

    var now = new Date();
    User.entityExport({ }) // ctime: undefined
        .then(function(entity){
            test.equal(entity.ctime.getDay(), now.getDay()); // default
        }).catch(function(e){
            test.strictEqual(e, undefined);
        });
    testEntityExport({ ctime: now }, { ctime: now }); // ok
    testEntityExport({ ctime: 1000 }, { ctime: new Date('Thu Jan 01 1970 02:00:01 GMT+0200 (EET)') }); // converted
    testEntityExport({ ctime: '2012-03-04 15:16:17' }, { ctime: new Date('Sun Mar 04 2012 15:16:17 GMT+0200 (EET)') }); // converted

    testEntityExport({ obj: undefined }, { obj: null }); // not required, goes NULL
    testEntityExport({ obj: 1 }, { obj: null }); // not required, goes NULL
    testEntityExport({ obj: {a:1} }, { obj: {a:1} }); // ok
    testEntityExport({ obj: [1,2,3] }, { obj: [1,2,3] }); // an array is also an object

    testEntityExport({ roles: undefined }, { roles: null }); // wrong, null
    testEntityExport({ roles: 1 }, { roles: [1] }); // converted
    testEntityExport({ roles: [1] }, { roles: [1] }); // ok

    testEntityExport({ json: undefined }, { json: null }); // not ok: no `undefined` in JSON
    testEntityExport({ json: null }, { json: null }); // ok, as not required
    testEntityExport({ json: 1 }, { json: '1' }); // ok
    testEntityExport({ json: '1' }, { json: '"1"' }); // ok
    testEntityExport({ json: {a:1} }, { json: '{"a":1}' }); // ok

    testEntityExport({ any: [1,{a:1}] }, { any: [1,{a:1}] }); // ok

    testEntityExport({ smile: 123 }, { smile: '123 :)' }); // overwritten

    testEntityExport({ enabled: 'f' }, { enabled: false }); // ok
    testEntityExport({ enabled: false }, { enabled: false }); // ok
    testEntityExport({ enabled: 0 }, { enabled: false }); // ok

    test.done();
};


/** Test {util.model.Converter} default values handling
 * @param {test|assert} test
 */
exports.testConverterDefaults = function(test){
    var schema = new Schema('memory'),
        Model = schema.define('Model', {
            stro:   { type: 'string',   required: false,    def: 'abc' },
            str:    { type: 'string',   required: true,     def: 'abc' },
            numo:   { type: 'number',   required: false,    def: 123 },
            num:    { type: 'number',   required: true,     def: 123 },
            anyo:   { type: 'any',      required: false,    def: '!!!' },
            any:    { type: 'any',      required: true,     def: '!!!' },

            s: String,
            n: Number,
            a: 'any'
        }, { pk: 'num' });

    schema.connect(); // just

    var testEntityExport = function(entity, expected){
        Model.entityExport(entity)
            .then(function(entity){
                test.deepEqual(entity, expected);
            })
            .catch(function(e){
                test.ok(false, e.stack);
            }).done();
    };

    // Should feed defaults for all `undefined`
    testEntityExport({}, {
        stro: 'abc', str: 'abc',
        numo: 123, num: 123,
        anyo: '!!!', any: '!!!'
    });

    // Should feed defaults for all `undefined`
    testEntityExport({
        stro: undefined, str: undefined, s: undefined,
        numo: undefined, num: undefined, n: undefined,
        anyo: undefined, any: undefined, a: undefined
    }, {
        stro: 'abc', str: 'abc', s: null,
        numo: 123, num: 123, n: null,
        anyo: '!!!', any: '!!!', a: undefined
    });

    // Should feed defaults for all `null` and required
    testEntityExport({
        stro: null, str: null, s: null,
        numo: null, num: null, n: null,
        anyo: null, any: null, a: null
    }, {
        stro: null, str: 'abc', s: null,
        numo: null, num: 123, n: null,
        anyo: null, any: '!!!', a: null
    });

    test.done();
};



/** Test MissyProjection
 * @param {test|assert} test
 */
exports.testMissyProjection = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {});

    schema.connect(); // just ignore the result

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
    test.deepEqual(new u.MissyProjection(), { projection: {}, inclusionMode: false });
    test.deepEqual(new u.MissyProjection({}), { projection: {}, inclusionMode: false });
    test.deepEqual(new u.MissyProjection(''), { projection: {}, inclusionMode: false });
    test.deepEqual(new u.MissyProjection([]), { projection: {}, inclusionMode: false });
    test.deepEqual(new u.MissyProjection().toString(), '*');

    // Array syntax
    test.deepEqual(
        new u.MissyProjection(['a','b','c']),
        { projection: { a:1, b:1, c:1 }, inclusionMode: true }
    );

    // String syntax
    test.deepEqual(
        new u.MissyProjection('*'),
        { projection: {}, inclusionMode: false }
    );
    test.deepEqual(
        new u.MissyProjection('a,b,c'),
        { projection: { a:1, b:1, c:1 }, inclusionMode: true }
    );
    test.deepEqual(
        new u.MissyProjection('+a,b,c'),
        { projection: { a:1, b:1, c:1 }, inclusionMode: true }
    );
    test.deepEqual(
        new u.MissyProjection('-a,b,c'),
        { projection: { a:0, b:0, c:0 }, inclusionMode: false }
    );

    // Object: inclusion
    p = new u.MissyProjection({ a:1, b:1, c:1 });
    test.deepEqual(p, { projection: { a:1, b:1, c:1 }, inclusionMode: true });
    test.equal(p.toString(), '+a,b,c');

    // Object: exclusion
    p = new u.MissyProjection({ a:0, b:0, c:0 });
    test.deepEqual(p, { projection: { a:0, b:0, c:0 }, inclusionMode: false });
    test.equal(p.toString(), '-a,b,c');

    // getFieldDetails() when empty
    p = new u.MissyProjection();
    test.deepEqual(p.getFieldDetails(Profile), {
        fields: ['user_id', 'name', 'data'],
        pick: [],
        omit: []
    });

    // getFieldDetails() in inclusion mode
    p = new u.MissyProjection({ name: 1, aaaaa: 1 });
    test.deepEqual(p.getFieldDetails(Profile), {
        fields: ['name', 'aaaaa'],
        pick: ['name', 'aaaaa'],
        omit: []
    });

    // getFieldDetails() in exclusion mode
    p = new u.MissyProjection({ name: 0, aaaaa: 0 });
    test.deepEqual(p.getFieldDetails(Profile), {
        fields: ['user_id', 'data'],
        pick: [],
        omit: ['name', 'aaaaa']
    });

    // Self proxy
    p = new u.MissyProjection({ a:0, b:0, c:0 });
    p = new u.MissyProjection(p);
    test.deepEqual(p, { projection: { a:0, b:0, c:0 }, inclusionMode: false });

    // MissyProjection.entityApply()
    p = new u.MissyProjection();
    test.deepEqual(p.entityApply(Profile, {a:1,b:2,c:2}), {a:1,b:2,c:2}); // empty, unchanged

    p = new u.MissyProjection({user_id:1, c:1});
    test.deepEqual(p.entityApply(Profile, {user_id:1, a:2,b:3,c:4}), { user_id:1, c:4 }); // empty, unchanged

    p = new u.MissyProjection({user_id:0, c:0});
    test.deepEqual(p.entityApply(Profile, {user_id:1, a:2,b:3,c:4}), { a:2,b:3 }); // empty, unchanged

    test.done();
};



/** Test MissyCriteria
 * @param {test|assert} test
 */
exports.testMissyCriteria = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {});

    schema.connect(); // just ignore the result

    var Profile = schema.define('Page', {
        category: String,
        id: Number,
        title: String,
        tags: Array
    }, { pk: ['category', 'id'] });

    var c;
    var mcEqual = function(criteria, expected){
        test.deepEqual(
            _.omit(c, ['model'].concat(_.methods(criteria))),
            expected
        );
    };

    // Empty & wrong
    c = new u.MissyCriteria(Profile);
    mcEqual(c, { criteria: {} });

    c = new u.MissyCriteria(Profile, null);
    mcEqual(c, { criteria: {} });

    c = new u.MissyCriteria(Profile, undefined);
    mcEqual(c, { criteria: {} });

    c = new u.MissyCriteria(Profile, 1);
    mcEqual(c, { criteria: {} });

    // Ok & convertion
    c = new u.MissyCriteria(Profile, { user_id: '1', title: 1, tags: 'a', aaaaa: 1 });
    mcEqual(c, { criteria: {
        user_id: { $eq: 1 }, // converted
        title: { $eq: '1' }, // converted
        tags: { $eq: ['a'] }, // converted
        aaaaa: { $eq: 1 } // custom property unchanged
    } });

    c = new u.MissyCriteria(Profile, {
        user_id: { $exists: true },
        title: { $ne: 0 },
        aaaaa: { $in: ['public', 1] }
    });
    mcEqual(c, { criteria: {
        user_id: { $exists: true },
        title: { $ne: '0' },
        aaaaa: { $in: ['public', '1'] }
    } });

    // Unknown operator
    test.throws(function(){
        new u.MissyCriteria(Profile, { anything: { $wrong: 1 } });
    }, errors.MissyModelError);

    // MissyCriteria.fromPk
    var Log = schema.define('Log', {
        uid: Number,
        type: String,
        id: Number,
        title: String,
        tags: Array,
        entry: Object
    }, { pk: ['uid', 'type', 'id'] });

    test.throws(function(){
        u.MissyCriteria.fromPk(Log, 1);
    }, errors.MissyModelError);

    test.throws(function(){
        u.MissyCriteria.fromPk(Log, [1]);
    }, errors.MissyModelError);

    test.throws(function(){
        u.MissyCriteria.fromPk(Log, [1,2]);
    }, errors.MissyModelError);

    c = u.MissyCriteria.fromPk(Log, [1,2,'3']);
    mcEqual(c, { criteria: {
        uid: { $eq: 1 },
        type: { $eq: '2' },
        id: { $eq: 3 }
    } });

    test.throws(function(){
        u.MissyCriteria.fromPk(Log, [1,2,3,4]);
    }, errors.MissyModelError);

    // MissyCriteria.entityMatch
    var logs = [
        { uid: 1, type: 'sms', id: 1, title: 'hello', tags: ['a','b'], entry: { msg: 'you there?' } },
        { uid: 1, type: 'sms', id: 2, title: 'yes, here', tags: undefined },
        { uid: 2, type: 'sms', id: 3, title: 'wassup?', tags: undefined }
    ];
    var testCriteria = function(criteria, logs, expected){
        _.each(logs, function(log, i){
            test.equal(criteria.entityMatch(log), expected[i], 'Expected Criteria.entityMatch(logs['+i+']) = ' + expected[i]);
        });
    };

    testCriteria( new u.MissyCriteria(Log, { }), logs, [true,true,true]);
    testCriteria(new u.MissyCriteria(Log, { uid: 1 }), logs, [true,true,false]);
    testCriteria(new u.MissyCriteria(Log, { uid: '1', type: 'test' }), logs, [false,false,false]);
    testCriteria(new u.MissyCriteria(Log, { uid: 1, type: 'sms' }), logs, [true,true,false]);
    testCriteria(new u.MissyCriteria(Log, { uid: 2, type: 'sms' }), logs, [false,false,true]);

    testCriteria(new u.MissyCriteria(Log, { id: { $gt: '2' } }), logs, [false,false,true]);
    testCriteria(new u.MissyCriteria(Log, { id: { $gte: '2' } }), logs, [false,true,true]);
    testCriteria(new u.MissyCriteria(Log, { id: { $lt: '2' } }), logs, [true,false,false]);
    testCriteria(new u.MissyCriteria(Log, { id: { $lte: '2' } }), logs, [true,true,false]);
    testCriteria(new u.MissyCriteria(Log, { id: { $lte: '2' } }), logs, [true,true,false]);
    testCriteria(new u.MissyCriteria(Log, { id: { $ne: '2' } }), logs, [true,false,true]);
    testCriteria(new u.MissyCriteria(Log, { id: { $eq: '2' } }), logs, [false,true,false]);
    testCriteria(new u.MissyCriteria(Log, { id: { $in: ['1',3,4] } }), logs, [true,false,true]);
    testCriteria(new u.MissyCriteria(Log, { id: { $nin: [1,3,4] } }), logs, [false,true,false]);
    testCriteria(new u.MissyCriteria(Log, { entry: { $exists: true } }), logs, [true,false,false]);
    testCriteria(new u.MissyCriteria(Log, { entry: { $exists: false } }), logs, [false,true,true]);

    test.done();
};



/** Test MissySort
 * @param {test|assert} test
 */
exports.testMissySort = function(test){
    var s;

    // Empty
    s = new u.MissySort();
    test.deepEqual(s, { sort: {} });

    s = new u.MissySort(undefined);
    test.deepEqual(s, { sort: {} });

    s = new u.MissySort(null);
    test.deepEqual(s, { sort: {} });

    s = new u.MissySort('');
    test.deepEqual(s, { sort: {} });

    s = new u.MissySort([]);
    test.deepEqual(s, { sort: {} });

    s = new u.MissySort({});
    test.deepEqual(s, { sort: {} });

    // String syntax
    s = new u.MissySort('a,b+,c-');
    test.deepEqual(s, { sort: { a:1, b:1, c:-1 } });
    test.equal(s.toString(), 'a+,b+,c-');

    // Array syntax
    s = new u.MissySort(['a','b+', 'c-']);
    test.deepEqual(s, { sort: { a:1, b:1, c:-1 } });

    // Object syntax
    s = new u.MissySort({ a:1,b:-1,c:0,d:2 });
    test.deepEqual(s, { sort: { a:1, b:-1, c:-1, d:1 } });

    // MissySort.entitiesSort
    var a = { id: 1, level: 0, title: 'zxy', cat: 0 },
        b = { id: 2, level: 2, title: 'jkl', cat: 0 },
        c = { id: 3, level: 1, title: 'ghi', cat: 1 },
        d = { id: 4, level: 3, title: 'abc', cat: 1 },
        db = [ a,b,c,d ];

    test.deepEqual(
        new u.MissySort({id:-1}).entitiesSort(db),
        [ d,c,b,a ]
    );

    test.deepEqual(
        new u.MissySort({level:-1}).entitiesSort(db),
        [ d,b,c,a ]
    );

    test.deepEqual(
        new u.MissySort({title:+1}).entitiesSort(db),
        [ d,c,b,a ]
    );

    test.deepEqual(
        new u.MissySort({cat:-1, id: +1}).entitiesSort(db),
        [ c,d,a,b ]
    );

    test.deepEqual(
        new u.MissySort({cat:-1, id: -1}).entitiesSort(db),
        [ d,c,b,a ]
    );

    test.deepEqual(
        new u.MissySort({cat:+1, id: +1}).entitiesSort(db),
        [ a,b,c,d ]
    );

    test.deepEqual(
        new u.MissySort({cat:+1, id: -1}).entitiesSort(db),
        [ b,a,d,c ]
    );

    test.done();
};



/** Test MissyUpdate
 * @param {test|assert} test
 */
exports.testMissyUpdate = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {});

    schema.connect(); // just ignore the result

    var Profile = schema.define('Page', {
        id: Number,
        title: String,
        tags: Array
    }, { pk: 'id' });

    var upd;

    upd = new u.MissyUpdate(Profile, {
        a:1,
        $set: {b:2},
        $inc: {c:3},
        $unset: {d:''},
        $setOnInsert: {e:5},
        $rename:{f:'g'},
        title:1,
        tags:'a'
    });

    test.deepEqual(upd.update, {
        $set: {
            a:1,
            b:2, // moved
            title:'1', // converted
            tags:['a'] // converted
        },
        $inc: {c:3},
        $unset: {d:''},
        $setOnInsert: {e:5},
        $rename:{f:'g'}
    });

    // MissyUpdate.entityUpdate
    test.deepEqual(upd.entityUpdate({}), {a:1,b:2,c:3,title:'1',tags:['a']});
    test.deepEqual(upd.entityUpdate({d:4,f:6}), {a:1,b:2,c:3,g:6,title:'1',tags:['a']});

    // MissyUpdate.entityInsert
    test.deepEqual(upd.entityInsert(), { a:1,b:2,c:3,e:5,title:'1',tags:['a']});
    test.deepEqual(
        upd.entityInsert(
            new u.MissyCriteria(Profile, { id:10, n: {$gt:5} })
        ),
        { id:10,a:1,b:2,c:3,e:5,title:'1',tags:['a']}
    );

    test.done();
};
