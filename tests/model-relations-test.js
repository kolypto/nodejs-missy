'use strict';

var Q = require('q'),
    _ = require('lodash'),
    Schema = require('../lib').Schema,
    MemoryDriver = require('../lib').drivers.memory,
    errors = require('../lib/errors'),
    common = require('./common')
    ;

Q.longStackSupport = true;

/** Set up the Schema
 */
exports.setUp = function(callback){
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

    _.extend(this, {
        driver: driver,
        schema: schema,
        User: User,
        Profile: Profile,
        Device: Device,
        Message: Message
    });

    schema.connect()
        .nodeify(callback);
};

/** Test Relations structure
 * @param {test|assert} test
 */
exports.testStructure = function(test){
    var User = this.User,
        Profile = this.Profile,
        Device = this.Device,
        Message = this.Message,
        driver = this.driver
        ;

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

    test.done();
};

/** Test Relations with loadRelated()
 * @param {test|assert} test
 */
exports.testModelLoadRelated = function(test){
    var User = this.User,
        Profile = this.Profile,
        Device = this.Device,
        Message = this.Message,
        driver = this.driver
        ;

    // Helpers
    var shouldNever = common.shouldNeverFunc(test);

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
                // hasOne with duplicate entities
                function(){
                    User.loadRelated([
                            { id: 1 },
                            { id: 1 },
                            { id: 1 }
                        ], 'profile')
                        .then(function(entities){
                            test.equal(entities.length, 3);
                            test.deepEqual(entities[0], { id: 1, profile: { id:1, name: 'First Man', age: 25 } });
                            test.deepEqual(entities[1], { id: 1, profile: { id:1, name: 'First Man', age: 25 } });
                            test.deepEqual(entities[2], { id: 1, profile: { id:1, name: 'First Man', age: 25 } });
                        })
                        .catch(shouldNever('Test: Model.loadRelated :: hasOne: User.profile'));
                },
            ].reduce(Q.when, Q(1));
        },
        // Test: Model.withRelated().findOne()
        function(){
            User
                .withRelated('profile')
                .withRelated('devices', { uid: 1, title: 1 }, { title: -1 })
                .findOne({ id:1 }, {id:1})
                .then(function(entity){
                    test.deepEqual(entity, {
                        id:1,
                        profile: { id:1, name: 'First Man', age: 25 },
                        devices: [
                            { uid: 1, title: 'Samsung' },
                            { uid: 1, title: 'IBM' },
                            { uid: 1, title: 'HTC' }
                        ]
                    });
                })
                .catch(shouldNever('Test: Model.withRelated().find()'));
        },
        // Test: Model.withRelated().find()
        function(){
            User
                .withRelated('profile')
                .withRelated('devices', { uid: 1, title: 1 }, { title: -1 })
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
                .catch(shouldNever('Test: Model.withRelated().find()'));
        },
        // Test: Model.withRelated().find() and deep eager loading
        function(){
            User
                .withRelated('devices')
                .withRelated('devices.messages')
                .withRelated('devices.messages.device')
                .withRelated('devices.messages.device.user', { id:1 })
                .find({}, { id:1 }, { id:-1 })
                .then(function(entities){
                    test.equal(entities.length, 4);
                    test.deepEqual(entities[0], {
                        id:4,
                        devices: []
                    });
                    test.deepEqual(entities[1], {
                        id:3,
                        devices: []
                    });
                    test.deepEqual(entities[2], {
                        id:2,
                        devices: [
                            { uid: 2, type: 'phone', sn: '3456', title: 'Sony', messages: [
                                { device_type: 'phone', device_sn: '3456', msg_id: 2, body: 'Hi',
                                    device: { uid: 2, type: 'phone', sn: '3456', title: 'Sony',
                                        user: { id: 2 }
                                    }
                                },
                                { device_type: 'phone', device_sn: '3456', msg_id: 4, body: 'Fine',
                                    device: { uid: 2, type: 'phone', sn: '3456', title: 'Sony',
                                        user: { id: 2 }
                                    }
                                }
                            ] }
                        ]
                    });
                    test.deepEqual(entities[3], {
                        id:1,
                        devices: [
                            { uid: 1, type: 'pc', sn: '1234', title: 'IBM', messages: [] },
                            { uid: 1, type: 'phone', sn: '5678', title: 'HTC', messages:[
                                { device_type: 'phone', device_sn: '5678', msg_id: 1, body: 'Hello',
                                    device: { uid: 1, type: 'phone', sn: '5678', title: 'HTC',
                                        user: { id: 1 }
                                    }
                                },
                                { device_type: 'phone', device_sn: '5678', msg_id: 3, body: 'How are u?',
                                    device: { uid: 1, type: 'phone', sn: '5678', title: 'HTC',
                                        user: { id: 1 }
                                    }
                                },
                            ] },
                            { uid: 1, type: 'tablet', sn: '9012', title: 'Samsung', messages:[
                                { device_type: 'tablet', device_sn: '9012', msg_id: 5, body: 'Wanna fun?',
                                    device: { uid: 1, type: 'tablet', sn: '9012', title: 'Samsung',
                                        user: { id: 1 }
                                    }
                                }
                            ] }
                        ]
                    });
                })
                .catch(shouldNever('Test: Model.withRelated().find() and deep eager loading'));
        }
    ].reduce(Q.when, Q(1))
        .catch(shouldNever('Test error'))
        .finally(function(){
            test.done();
        }).done();
};

/** Test Relations with saveRelated()
 * @param {test|assert} test
 */
exports.testModelSaveRelated = function(test){
    var User = this.User,
        Profile = this.Profile,
        Device = this.Device,
        Message = this.Message,
        driver = this.driver
        ;

    // Helpers
    var shouldNever = common.shouldNeverFunc(test);

    return [
        // Test: Model.saveRelated
        function(){
            return [
                // hasOne(), single-field
                function(){
                    return User
                        .withRelated('profile')
                        .save([
                            { id: 1, profile: { name: 'First', age: 20 } },
                            { id: 2, profile: { name: 'Second', age: 25 } },
                            { id: 3, profile: { name: 'Third', age: 30 } },
                            { id: 4 }
                        ])
                        .catch(shouldNever('Test: Model.saveRelated :: hasOne(), single-field'))
                        .then(function(entities){
                            test.equal(entities.length, 4);
                            test.deepEqual(entities, [
                                // relation field is dropped
                                { id: 1 },
                                { id: 2 },
                                { id: 3 },
                                { id: 4 }
                            ]);

                            test.equal(driver.getTable(User).length, 4);
                            test.deepEqual(driver.getTable(User), entities); // relation field is not saved

                            test.equal(driver.getTable(Profile).length, 3);
                            test.deepEqual(driver.getTable(Profile), [
                                { id: 1, name: 'First', age: 20 },
                                { id: 2, name: 'Second', age: 25 },
                                { id: 3, name: 'Third', age: 30 }
                            ]);
                        });
                },
                // hasOne(), multi-field
                function(){
                    process.env.test = 1;
                    return Message
                        .withRelated('device')
                        .save([
                            { device_type: 'phone', device_sn: 'ABCD', msg_id: 1, body: 'Hello',
                                device: { uid: 1, title: 'HTC' }
                            },
                            { device_type: 'tablet', device_sn: '1234', msg_id: 2, body: 'Hi',
                                device: { uid: 2, title: 'Samsung' }
                            },
                            { device_type: 'phone', device_sn: 'ABCD', msg_id: 3, body: 'How are u?',
                                device: { uid: 1, title: 'HTC' } // from the same device!
                            }
                        ])
                        .catch(shouldNever('Test: Model.saveRelated :: hasOne(), multi-field'))
                        .then(function(entities){
                            test.equal(entities.length, 3);
                            test.deepEqual(entities, [
                                // relation field is dropped
                                { device_type: 'phone', device_sn: 'ABCD', msg_id: 1, body: 'Hello' },
                                { device_type: 'tablet', device_sn: '1234', msg_id: 2, body: 'Hi' },
                                { device_type: 'phone', device_sn: 'ABCD', msg_id: 3, body: 'How are u?' }
                            ]);

                            test.equal(driver.getTable(Message).length, 3);
                            test.deepEqual(driver.getTable(Message), entities); // relation fields is not saved

                            test.equal(driver.getTable(Device).length, 2);
                            test.deepEqual(driver.getTable(Device), [
                                { uid: 1, type: 'phone', sn: 'ABCD', title: 'HTC' },
                                { uid: 2, type: 'tablet', sn: '1234', title: 'Samsung' }
                            ]);
                        });
                },
                // hasMany(), single-field
                function(){
                    return User
                        .withRelated('devices')
                        .update({
                            id: 1,
                            devices: [
                                { type: 'phone', sn: 'ABCD', title: 'htc' }, // same device, but lowercased
                                { type: 'phone', sn: 'EFGH', title: 'Sony' } // new device
                            ]
                        })
                        .catch(shouldNever('Test: Model.saveRelated :: hasMany(), single-field'))
                        .then(function(entity){
                            test.deepEqual(entity, { id: 1 });

                            test.equal(driver.getTable(Device).length, 3);
                            test.deepEqual(driver.getTable(Device), [
                                { uid: 1, type: 'phone', sn: 'ABCD', title: 'htc' }, // replaced
                                { uid: 2, type: 'tablet', sn: '1234', title: 'Samsung' },
                                { uid: 1, type: 'phone', sn: 'EFGH', title: 'Sony' } // added
                            ]);
                        });
                },
                // hasMany(), multi-field
                function(){
                    return Device
                        .withRelated('messages')
                        .insert(
                            { uid: 3, type: 'ipad', sn: 'zyxw', title: 'iPad',
                                messages: [
                                    { msg_id: 4, body: 'Hi bro' },
                                    { msg_id: 5, body: 'Wassup?' },
                                ]
                            }
                        )
                        .catch(shouldNever('Test: Model.saveRelated :: hasMany(), multi-field'))
                        .then(function(entity){
                            test.equal(_.isArray(entity), false);
                            test.deepEqual(entity, { uid: 3, type: 'ipad', sn: 'zyxw', title: 'iPad' });

                            test.equal(driver.getTable(Device).length, 4);
                            test.deepEqual(driver.getTable(Device)[3], entity);

                            test.equal(driver.getTable(Message).length, 5);
                            test.deepEqual(driver.getTable(Message).slice(-2), [
                                { msg_id: 4, body: 'Hi bro', device_type: 'ipad', device_sn: 'zyxw' },
                                { msg_id: 5, body: 'Wassup?', device_type: 'ipad', device_sn: 'zyxw' },
                            ]);
                        });
                },
            ].reduce(Q.when, Q());
        },
        // Test: Model.removeRelated
        function(){
            return [
                // hasOne
                function(){
                    return User
                        .withRelated('profile')
                        .remove({ id: 2 }) // note: we don't have to specify the profile here.
                        .catch(shouldNever('Test: Model.removeRelated :: hasOne'))
                        .then(function(entity){
                            test.deepEqual(entity, { id: 2 });

                            test.equal(driver.getTable(User).length, 3);
                            test.equal(driver.getTable(Profile).length, 2);
                        });
                },
                // hasMany
                function(){
                    return Device
                        .withRelated('messages')
                        .remove({ uid: 3, type: 'ipad', sn: 'zyxw', title: 'iPad' })
                        .catch(shouldNever('Test: Model.removeRelated :: hasMany'))
                        .then(function(entity){
                            test.deepEqual(entity, { uid: 3, type: 'ipad', sn: 'zyxw', title: 'iPad' });

                            test.equal(driver.getTable(Device).length, 3);
                            test.equal(driver.getTable(Message).length, 3);
                        });
                }
            ].reduce(Q.when, Q());
        },
    ].reduce(Q.when, Q())
        .catch(shouldNever('Test error'))
        .finally(function(){
            test.done();
        })
        .done();
};
