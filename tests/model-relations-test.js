'use strict';

var Q = require('q'),
    _ = require('lodash'),
    Schema = require('../lib').Schema,
    MemoryDriver = require('../lib').drivers.MemoryDriver,
    errors = require('../lib/errors')
    ;

Q.longStackSupport = true;

/** Test Relations
 * @param {test|assert} test
 */
exports.testModelRelations = function(test){
    var driver = new MemoryDriver(),
        schema = new Schema(driver, {})
        ;

    // Models
    var User = schema.define('User', {
        id: Number,
        login: String
    }, { pk: 'id' });

    var Profile = schema.define('Profile', {
        id: Number,
        name: String,
        age: Number
    }, { pk: 'id' });

    var Device = schema.define('Device', {
        uid: Number,
        type: String,
        sn: String,
        title: String
    }, { pk: ['uid','type','sn'] });

    var Message = schema.define('Message', {
        device_type: String,
        device_sn: String,
        msg_id: Number,
        body: String
    }, { pk: ['device_type','device_sn', 'msg_id'] });

    // Relations
    User.hasOne('profile', Profile, 'id');
    User.hasMany('devices', Device, {'id':'uid'});

    Profile.hasOne('user', User, 'id');

    Device.hasOne('user', User, {'uid':'id'});
    Device.hasMany('messages', Message, { 'type':'device_type', 'sn':'device_sn' });

    Message.hasOne('device', Device, { 'device_type':'type', 'device_sn':'sn' });

    // Helpers
    var shouldNever = function(title){
        return function(e){
            test.ok(false, 'Should never get here: ' + title, arguments);
            if (e && e instanceof Error)
                console.error(e.stack);
        };
    };

    // Structural tests
    test.deepEqual(Object.keys(User.relations), ['profile', 'devices']);
    test.deepEqual(Object.keys(Profile.relations), ['user']);
    test.deepEqual(Object.keys(Device.relations), ['user', 'messages']);
    test.deepEqual(Object.keys(Message.relations), ['device']);

    test.deepEqual(User.relations.profile.fields, {'id':'id'});
    test.deepEqual(User.relations.devices.fields, {'id':'uid'});
    test.deepEqual(Profile.relations.user.fields, {'id':'id'});
    test.deepEqual(Device.relations.user.fields, {'uid':'id'});
    test.deepEqual(Device.relations.messages.fields, { 'type':'device_type', 'sn':'device_sn' });
    test.deepEqual(Message.relations.device.fields, { 'device_type':'type', 'device_sn':'sn' });

    [
        // DB fixtures
        function(){
            return Q.all([
                User.save([
                    { id:1, login: 'first' }, // 3 devices, 6 messages
                    { id:2, login: 'second' }, // 1 device, 2 messages
                    { id:3, login: 'third' }, // no devices, no messages
                    { id:4, login: 'empty'}, // no profile, no devices, no messages
                ]),
                Profile.save([
                    { id:1, name: 'First Man', age: 25 },
                    { id:2, name: 'Second Person', age: 40 },
                    { id:3, name: 'Third face', age: null },
                ]),
                Device.save([
                    { uid: 1, type: 'pc', sn: '1234', title: 'IBM' }, // no messages
                    { uid: 1, type: 'phone', sn: '5678', title: 'HTC' }, // 2 messages
                    { uid: 1, type: 'tablet', sn: '9012', title: 'Samsung' }, // 1 message
                    { uid: 2, type: 'phone', sn: '3456', title: 'Sony' }, // 2 messages
                    { uid: 9, type: 'unk', sn: '', title: 'Unknown' }, // no user
                ]),
                Message.save([
                    { device_type: 'phone', device_sn: '5678', msg_id: 1, body: 'Hello' }, // uid:1, phone
                    { device_type: 'phone', device_sn: '3456', msg_id: 2, body: 'Hi' }, // uid:2, phone
                    { device_type: 'phone', device_sn: '5678', msg_id: 3, body: 'How are u?' }, // uid:1, phone
                    { device_type: 'phone', device_sn: '3456', msg_id: 4, body: 'Fine' }, // uid:2, phone
                    { device_type: 'tablet', device_sn: '9012', msg_id: 5, body: 'Wanna fun?' }, // uid:1, tablet
                    { device_type: 'unk', device_sn: '', msg_id: 6, body: 'system message' }, // uid:9, unk
                    { device_type: '', device_sn: '', msg_id: 7, body: 'FBI here!' }, // no device
                ]),
            ]);
        },
        // Test: Model.loadRelated
        function(){
            return [
                // hasOne: User.profile
                function(){
                    User.loadRelated([
                        { id: 1 }, // profile: id=1
                        { id: 2 }, // profile: id=2
                        { id: 9 }, // profile: no
                        { a: 1} // no PK
                    ], 'profile')
                        .then(function(entities){
                            test.equal(entities.length, 4);
                            test.deepEqual(entities[0], { id: 1, profile: { id:1, name: 'First Man', age: 25 } });
                            test.deepEqual(entities[1], { id: 2, profile: { id:2, name: 'Second Person', age: 40 } });
                            test.deepEqual(entities[2], { id: 9, profile: undefined });
                            test.deepEqual(entities[3], { a: 1, profile: undefined });
                        })
                        .catch(shouldNever('Test: Model.loadRelated :: hasOne: User.profile'));
                },
                // hasOne: Message.device, multicolumn, with projection
                function(){
                    Message.loadRelated([
                            { device_type: 'phone', device_sn: '5678' }, // exists
                            { device_type: 'phone', device_sn: '3456' }, // exists
                            { device_type: '', device_sn: '' }, // no device
                            { a:1 } // no PK
                        ], 'device', { title: 0 })
                        .then(function(entities){
                            test.equal(entities.length, 4);
                            test.deepEqual(entities[0], { device_type: 'phone', device_sn: '5678', device: { uid: 1, type: 'phone', sn: '5678' } });
                            test.deepEqual(entities[1], { device_type: 'phone', device_sn: '3456', device: { uid: 2, type: 'phone', sn: '3456' } });
                            test.deepEqual(entities[2], { device_type: '', device_sn: '', device: undefined });
                            test.deepEqual(entities[3], { a: 1, device: undefined });
                        })
                        .catch(shouldNever('Test: Model.loadRelated :: hasOne: Message.device, multicolumn, with projection'));
                },
                // Projection excludes foreign key fields
                function(){
                    Message.loadRelated([], 'device', { type: 0 })
                        .then(shouldNever('Test: Model.loadRelated :: Projection excludes foreign key fields'))
                        .catch(function(e){
                            test.ok(e instanceof errors.MissyRelationError);
                        });
                },
                // hasMany: User.devices with projection & sort
                function(){
                    User.loadRelated([
                            { id: 1 }, // 1 device
                            { id: 2 }, // 2 devices
                            { id: 8 }, // no devices
                            { a: 1} // no PK
                        ], 'devices', { uid: 1, title: 1 }, { title: -1 })
                        .then(function(entities){
                            test.equal(entities.length, 4);
                            test.deepEqual(entities[0], { id: 1, devices: [
                                // sorting & projection ok
                                { uid: 1, title: 'Samsung' },
                                { uid: 1, title: 'IBM' },
                                { uid: 1, title: 'HTC' }
                            ] });
                            test.deepEqual(entities[1], { id: 2, devices: [
                                { uid: 2, title: 'Sony' }
                            ] });
                            test.deepEqual(entities[2], { id: 8, devices: [] });
                            test.deepEqual(entities[3], { a: 1, devices: [] });
                        })
                        .catch(shouldNever('Test: Model.loadRelated :: hasMany: User.devices'));
                },
                // hasMany: Device.messages
                function(){
                    Device.loadRelated([
                        { type: 'phone', sn: '5678' }, // 2 messages
                        { type: 'phone', sn: '3456' }, // 2 messages
                        { type: 'pc', sn: '1234' }, // no messages
                        { type: 'lol' }, // no FK
                    ], 'messages', { body: 0 })
                        .then(function(entities){
                            test.equal(entities.length, 4);
                            test.deepEqual(entities[0], { type: 'phone', sn: '5678', messages: [
                                { device_type: 'phone', device_sn: '5678', msg_id: 1 },
                                { device_type: 'phone', device_sn: '5678', msg_id: 3 }
                            ] });
                            test.deepEqual(entities[1], { type: 'phone', sn: '3456', messages: [
                                { device_type: 'phone', device_sn: '3456', msg_id: 2 },
                                { device_type: 'phone', device_sn: '3456', msg_id: 4 }
                            ] });
                            test.deepEqual(entities[2], { type: 'pc', sn: '1234', messages: [] });
                            test.deepEqual(entities[3], { type: 'lol', messages: [] });
                        })
                        .catch(shouldNever('Test: Model.loadRelated :: hasMany: Device.messages'));
                },
            ].reduce(Q.when, Q(1));
        },
        // Test: Model.with().find()
        function(){
            User
                .with('profile')
                .with('devices', { uid: 1, title: 1 }, { title: -1 })
                .find({}, { id:1 }, { id:-1 })
                .then(function(entities){
                    test.equal(entities.length, 4);
                    test.deepEqual(entities[0], {
                        id:4,
                        profile: undefined,
                        devices: []
                    });
                    test.deepEqual(entities[1], {
                        id:3,
                        profile: { id:3, name: 'Third face', age: null },
                        devices: []
                    });
                    test.deepEqual(entities[2], {
                        id:2,
                        profile: { id:2, name: 'Second Person', age: 40 },
                        devices: [
                            { uid: 2, title: 'Sony' }
                        ]
                    });
                    test.deepEqual(entities[3], {
                        id:1,
                        profile: { id:1, name: 'First Man', age: 25 },
                        devices: [
                            { uid: 1, title: 'Samsung' },
                            { uid: 1, title: 'IBM' },
                            { uid: 1, title: 'HTC' }
                        ]
                    });
                })
                .catch(shouldNever('Test: Model.with().find()'));
        }
    ].reduce(Q.when, Q(1))
        .catch(shouldNever('Test error'))
        .then(function(){
            test.done();
        }).done();
};
