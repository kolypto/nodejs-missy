Missy
=====

Missy is a slim database-agnostic data mapper for NodeJS with pluggable drivers.

Whenever you need a truly flexible, lightweight DB tool - she's here for you.

Quick overview:

* Database-agnostic. Currently, PostgreSQL and MongoDB are supported
* Does not handle DB connections: you can customize & use the client of your choice
* Full CRUD operations support
* The support for custom data types
* Absolutely no limitations on the underlying schema
* Model events & hooks for full control
* Rich data selection control: projections, limit/offset, sorting
* Model relations, even between databases
* Honors custom fields not defined in the model: useful for schema-less databases like MongoDB
* MongoDB-style API
* Reliable DB reconnecting ; delaying query execution until it connects (optional)
* Promise-based: uses the [q](https://npmjs.org/package/q) package
* Amazingly simple and well-structured
* Documented and rich on comments
* 100% tests coverage



Table Of Contents
=================

* <a href="#glossary">Glossary</a>
* <a href="#tutorial">Tutorial</a>
* <a href="#core-classes">Core Classes</a>
    * <a href="#converter">Converter</a>
        * <a href="#type-handlers">Type Handlers</a>
        * <a href="#custom-type-handlers">Custom Type Handlers</a>
    * <a href="#missyprojection">MissyProjection</a>
    * <a href="#missycriteria">MissyCriteria</a>
    * <a href="#missysort">MissySort</a>
    * <a href="#missyupdate">MissyUpdate</a>
* <a href="#driver">Driver</a>
    * <a href="#supported-drivers">Supported Drivers</a>
* <a href="#schema">Schema</a>
    * <a href="#schemadriver-settings">Schema(driver, settings?)</a>
    * <a href="#schemadefinename-fields-optionsmodel">Schema.define(name, fields, options?):Model</a>
    * <a href="#schemaregistertypename-typehandlerschema">Schema.registerType(name, TypeHandler):Schema</a>
    * <a href="#schemaconnectpromise">Schema.connect():promise</a>
    * <a href="#schemadisconnectpromise">Schema.disconnect():promise</a>
    * <a href="#schemagetclient">Schema.getClient():*</a>
* <a href="#model">Model</a>
    * <a href="#model-definition">Model Definition</a>
        * <a href="#fields-definition">Fields Definition</a>
        * <a href="#model-options">Model Options</a>
    * <a href="#helpers">Helpers</a>
        * <a href="#modelgetclientobject">Model.getClient():Object</a>
        * <a href="#modelentityimportentityq">Model.entityImport(entity):Q</a>
        * <a href="#modelentityexportentityq">Model.entityExport(entity):Q</a>
    * <a href="#operations">Operations</a>
        * <a href="#read-operations">Read Operations</a>
            * <a href="#modelgetpk-fieldsq">Model.get(pk, fields?):Q</a>
            * <a href="#modelfindonecriteria-fields-sort-optionsq">Model.findOne(criteria?, fields?, sort?, options?):Q</a>
            * <a href="#modelfindcriteria-fields-sort-optionsq">Model.find(criteria?, fields?, sort?, options?):Q</a>
            * <a href="#modelcountcriteria-optionsq">Model.count(criteria?, options?):Q</a>
        * <a href="#write-operations">Write Operations</a>
            * <a href="#modelinsertentities-optionsq">Model.insert(entities, options?):Q</a>
            * <a href="#modelupdateentities-optionsq">Model.update(entities, options?):Q</a>
            * <a href="#modelsaveentities-optionsq">Model.save(entities, options?):Q</a>
            * <a href="#modelremoveentities-optionsq">Model.remove(entities, options?):Q</a>
        * <a href="#queries">Queries</a>
            * <a href="#modelupdatequerycriteria-update-optionsq">Model.updateQuery(criteria, update, options?):Q</a>
            * <a href="#modelremovequerycriteria-optionsq">Model.removeQuery(criteria, options?):Q</a>
        * <a href="#using-the-driver-directly">Using The Driver Directly</a>
    * <a href="#model-hooks">Model Hooks</a>
    * <a href="#relations">Relations</a>
        * <a href="#defining-relations">Defining Relations</a>
            * <a href="#modelhasoneprop-foreign-fields">Model.hasOne(prop, foreign, fields)</a>
            * <a href="#modelhasmanyprop-foreign-fields">Model.hasMany(prop, foreign, fields)</a>
        * <a href="#handling-related-entities">Handling Related Entities</a>
            * <a href="#modelloadrelatedentities-prop-fields-sort-optionsq">Model.loadRelated(entities, prop, fields?, sort?, options?):Q</a>
            * <a href="#modelsaverelatedentities-prop-optionsq">Model.saveRelated(entities, prop, options?):Q</a>
            * <a href="#modelremoverelatedentities-prop-optionsq">Model.removeRelated(entities, prop, options?):Q</a>
            * <a href="#modelwithrelatedprop-model">Model.withRelated(prop, ...):Model</a>
* <a href="#recipes">Recipes</a>
    * <a href="#validation">Validation</a>




Glossary
========

Commonly used terms:

<dl>
    <dt>Driver</dt>
    <dd>Database driver that handles low-level Missy queries like find, insert, save, etc.</dd>
    <dt>Schema</dt>
    <dd>A collection of Models bound to a database Driver. Also, Type Handlers are defined on it.</dd>
    <dt>Type Handler</dt>
    <dd>A class that converts Field values to/from the database</dd>
    <dt>Entity</dt>
    <dd>An entity is a document persisted in the database</dd>
    <dt>Model</dt>
    <dd>A Model defines fields on some DB namespace (table, collection, etc) and provides methods to access Entities.</dd>
    <dt>Field</dt>
    <dd>Fields are defined on a model and specify its name and type. Other options are available</dd>
    <dt>Relation</dt>
    <dd>A relation is a way of accessing the associated entities</dd>
</dl>






Tutorial
========

Let's peek at how Missy works:

```js
var missy = require('missy'),
    MongodbDriver = require('missy-mongodb')
    ;

// Driver
var mongoDriver = new MongodbDriver(function(){
    // Connecter function

}, {
    // driver options
    journal: true
});

// Schema
var schema = new missy.Schema(mongoDriver, {
    queryWhenConnected: false // when disconnected, queries will wait for the driver to connect
});

// Models
var User = schema.define('User', {
    // Fields definition
    _id: Number, // simple form
    name: { type: 'string', required: true }, // full form
    ctime: { type: 'date', def: function(){ return new Date(); } }, // with a default value
    sex: String,
    age: Number,
    description: String
}, {
    // Model options
    pk: '_id', // Primary key
    // table: 'users' // using the default table name: 'users'
});

var Post = schema.define('Post', {
    _id: Number,
    uid: Number, // author
    title: String,
    body: String,
    tags: Array
}, {
    pk: 'id',
    table: 'user_posts', // the default table name would have been 'posts'. Override this.
    entityPrototype: { // add methods to all entities
        addTag: function(tag){
            this.tags.push(tag);
        }
    }
});

var Comment = schema.define('Comment', {
    _id: Number,
    post_id: Number,
    name: String, // arbitrary user name
    body: String
});

// Relations
User.hasMany('posts', Post, { 'id': 'uid' }); // name, model, fields mapping
Post.hasOne('author', User, { 'uid': 'id' });
Comment.hasOne('post', Post, { 'post_id': '_id' });
Post.hasMany('comments', Comment, { '_id': 'post_id' });

// Model hooks
User.hooks.beforeExport = function(entity){ // adds a synchronous hook
    // validate sex
    if (['m','f'].indexOf(entity.sex) === -1)
        entity.sex = '?';
};

User.hooks.on('afterInsert', function(entities){ // event hook
    // When a new user is inserted, detect teenagers
    if (user.age < 18)
        console.log('teens here!');
});

// Connect & action!
schema.connect()
    .catch(function(){ // DB error
        console.error('DB connection failed');
    })

    // Saving entities
    .then(function(){
        return User
            .withRelated('posts') // save related entities as well
            .save([
                { _id: 1, name: 'Lily', sex: 'f', age: 19, // `ctime` gets the default
                  posts: [ // her posts
                        { // no `uid` field: it automatically gets a value
                            _id: 1, title: 'Help me', body: 'I broke my nail!', tags: ['help']
                        }
                    ]
                 },
                { _id: 2, name: 'Ivy', sex: 'f', age: 21 }, // no posts
                { _id: 3, name: 'Carrie', sex: 'f', age: '23' } // `age` converted to Number on save
            ]);
    })

    // Fetching entities
    .then(function(){ // promise-based success handler callback
        // Now the schema is connected and we can use the models
        return User
            .withRelated('posts') // eagerly load posts
            .withRelated('posts.comments') // deep eager load: also load all comments
            .find(
                { sex: 'f', age: { $gt: 18, $lt: 25 } }, // find girls aged from 18 to 25
                { description: 0 }, // exclude the description field from the result set
                { age: +1 } // sort by `age` ascending
            ); // the result is passed to the next `then()`
    })

    // Removing entities
    .then(function(girls){
        return User
            .with('posts') // with posts
            .remove(girls); // don't repeat this at home
    })

    // Updating an entity without loading it (!)
    .then(function(){
        return User.updateQuery(
            { sex: 'f', name: 'Lily' }, // match all girls named 'Lily'
            { $set: { description: 'Cute!' } } // set the `description` field to a compliment
        ); // the full updated entities are returned
    })

    // Removing an entity without loading it (!)
    .then(function(){
        return User.removeQuery( // remove all matching entities
            { sex: 'f', name: 'John' } // match all Johns pretending to be a girl
        ); // the removed entities are returned
    });
```






Core Classes
============

Most Missy methods use these so you'll need to know how to work with them. This includes:

* Converting values to/from the database format
* Specifying field projections
* Search criteria format
* Sorting entities
* Specifying the update expressions

Though most of them are designed after MongoDB, they're applicable to all DB drivers with no limitations.



Converter
---------

Source: [lib/util/model.js#Converter](lib/util/model.js)

`Converter` transparently transparently converts field values to/from the DB format.

NOTE: `Converter` does not touch fields that are not defined in the model! Keep this in mind when working with
NoSQL databases as in general documents can contain arbitrary fields.

Consider the example:

```js
var User = schema.define('User', {
    id: Number,
    name: String,
    login: { type: 'string', required: true },
    tags: Array,
    ctime: { type: 'date', required: true, def: function(){ return new Date(); })
};

User.save({ id: '1', name: 111, login: 'first', tags:'events' });
User.findOne({ id: '1' })
```

On save, the 'id' field is converted to a number, name and login - to string, tags - to array.
Also, 'ctime' is set to the current time as no value was not provided.

On find, the query criteria 'id' field is converted to a number, and the resulting entity is converted back.

In general, `Converter` does the following:

* Sets default values on fields that are `undefined` and have `def` field property set to either a value or a function.
* Applies *type handlers* to entity fields defined in the model.

### Type Handlers

`Converter` is driven by *type handlers*: classes which can convert a JS value to the DB format and back.

Each *type handler* has a name to be referenced in the model *fields definition*.
Alternatively, you can use a JS built-in object as a shortcut.

Missy defines some built-in type handlers in *lib/types/*:

|Name         | Shortcut         | JS Type        | Default           | Comment                                                       |
|-------------|------------------|----------------|-------------------|---------------------------------------------------------------|
| any         | -                | *              | undefined         | No-op converter to use the value as is                        |
| string      | String           | `String,null`  | `'', null`        | Ensure a string, or `null`                                    |
| number      | Number           | `Number,null`  | `0, null`         | Ensure a number, or `null`                                    |
| date        | Date             | `Date,null`    | `null`            | Convert to JS `Date`, or `null`                               |
| object      | Object           | `Object,null`  | `{}, null`        | Use a JS `Object`, or `null`.                                 |
| array       | Array            | `Array,null`   | `[], null`        | Ensure an array, or `null`. Creates arrays from scalar values |
| json        | -                | `String,null`  | `null`            | Un/serializes JSON, or `null`. Throws `MissyTypeError` on parse error.  |

Note: most built-in types allow `null` value only when the field is not defined as `required` (see below).

Note: DB drivers may define own type handlers and even redefine standard types for all models handled by the driver.

### Custom Type Handlers

A *type handler* is a class that implements the `IMissyTypeHandler` interface (*lib/interfaces.js*):

* Constructor receives 2 arguments: the schema to bind to, and the type handler name.
* Method `load(value, field)` which converts a value loaded from the database
* Method `save(value, field)` which converts a value to be stored to the database
* Method `norm(value, field)` which normalizes the value
* Has 2 properties: `schema` and `name`

Once the type handler is defined, you register in on a `Schema`:

```js
var stringTypeHandler = require('missy').types.String;
schema.registerType('string', stringTypeHandler);

// Now you can use it on a model:
var User = schema.define('User', {
    login: { type: 'string' }
});
```

Note: built-in types are registered automatically, there's no need to follow this example.



MissyProjection
---------------

Source: [lib/util/model.js#MissyProjection](lib/util/model.js)

When selecting entities from the DB, you may want to fetch a subset of fields. This is what `MissyProjection` does:
allows you to specify the fields to include or exclude from the resulting entities.

`MissyProjection` closely follows
[MongoDB Projections](http://docs.mongodb.org/manual/core/read-operations/#projections) specification.

A projection can be used in one of the 3 available modes:

* *all mode*. All available fields are fetched.
* *inclusion mode*. Fetch the named fields only.
* *exclusion mode*. Fetch all fields except the named ones.

The following projection input formats are supported:

* **String syntax**. Projection mode + Comma-separated field names.

    * `'*'`: include all fields
    * `'+a,b,c'`: include only fields *a, b, c*
    * `'-a,b,c'`: exclude fields *a, b, c*

* **Array syntax**. Array of field names to include.

    * `[]`: include all fields
    * `['a','b','c']`: include only fields *a, b, c*
    * Exclusion mode is not supported

* **Object syntax**. MongoDB-style projection object.

    * `{}`: include all fields
    * `{ a:1, b:1, c:1 }`: include only fields *a, b, c*
    * `{ a:0, b:0, c:0 }`: exclude fields *a, b, c*

* **MissyCriteria**. A `MissyCriteria` object.

Usage example:

```js
var User = schema.define('User', {
    id: Number,
    login: String,
    //...
});

User.find({}, { id:1, login: 1 }) // only fetch 2 fields: id, login
    .then(function(users){ ... });
```



MissyCriteria
-------------

Source: [lib/util/model.js#MissyCriteria](lib/util/model.js)

Specifies the search conditions.

Implements a simplified version of
[MongoDB `collection.find` criteria document](http://docs.mongodb.org/manual/reference/method/db.collection.find/):

* Use `{ field: value, .. }` syntax to match entities by equality ;
* Use `{field: { $operator: value, .. }, .. }` syntax to compare with an operator.

Example:

```js
{
    id: 1, // equality
    login: { $eq: 'kolypto' }, // equality with an operator
    role: { $in: ['admin','user'] }, // $in operator example
    age: { $gt: 18, $lt: 22 } // 2 operators on a single field
}
```

Note: To keep the implementation simple and effective, Missy does not support complex queries and logical operators.
    If you need them, see [Using The Driver Directly](#using-the-driver-directly).

The following operators are supported:

| Operator | Definition | Example                                 | Comment                                   |
|----------|------------|-----------------------------------------|-------------------------------------------|
| `$gt`    | >          | `{ money: { $gt: 20000 } }`             | Greater than                              |
| `$gte`   | <=         | `{ height: { $gte: 180 } }`             | Greater than or equal                     |
| `$eq`    | ==         | `{ login: { $eq: 'kolypto' } }`         | Equal to                                  |
| `$ne`    | !=         | `{ name: { $ne: 'Lucy' } }`             | Not equal to                              |
| `$lt`    | <          | `{ age: { $lt: 18 } }`                  | Lower than                                |
| `$lte`   | <=         | `{ weight: { $lte: 50 } }`              | Lower than or equal                       |
| `$in`    | IN         | `{ role: { $in: ['adm', 'usr' ] } }`    | In array of values. Scalar operand is converted to array. |
| `$nin`   | NOT IN     | `{ state: { $nin: ['init','error'] } }` | Not in array of values. Scalar operand is converted to array. |

Before querying, `MissyCriteria` uses `Converter` to convert the given field values to the DB types.
For instance, the `{ id: '1' }` criteria will be converted to `{ id: { $eq: 1 } }`.

Example:

```js
var User = schema.define('User', {
    age: Number,
    //...
});

User.find({ age: { $gt: 18, $lt: 22 } }) // 18 <= age <= 22
    .then(function(users){ ... });
```



MissySort
---------

Source: [lib/util/model.js#MissySort](lib/util/model.js)

Defines the sort order of the result set.

`MissySort` closely follows the
[MongoDB sort](http://docs.mongodb.org/manual/reference/method/cursor.sort/#cursor-sort) specification.

The following sort input formats are supported:

* **String syntax**. Comma-separated list of fields suffixed by the sorting operator: `+` or `-`.

    * `a,b+.c-`: sort by *a* asc, *b* asc, *c* desc

* **Array syntax**. Same as *String syntax*, but split into an array.

    * `['a', 'b+', 'c-' ]`: sort by *a* asc, *b* asc, *c* desc

* **Object syntax**. MongoDB-style object which maps field names to sorting operator: `1` or `-1`.

    * `{ a: 1, b: 1, c: -1 }`: sort by *a* asc, *b* asc, *c* desc

Example:

```js
var User = schema.define('User', {
    id: Number,
    age: Number,
    //...
});

User.find({}, {}, { age: -1 }) // sort by `age` descending
    .then(function(users){ ... });
```



MissyUpdate
-----------

Source: [lib/util/model.js#MissyUpdate](lib/util/model.js)

Declares the update operations to perform on matching entities.

`MissyUpdate` implements the simplified form of
[MongoDB update document](http://docs.mongodb.org/manual/reference/method/db.collection.update/#update-parameter).

* Use `{ field: value, .. }` syntax to set a field's value ;
* Use `{ $operator: { field: value } }` syntax to apply a more complex action defined by the operator.

Example:

```js
{
    mtime: new Date(),                      // assign a value
    $set: { mtime: new Date() },            // assign a value
    $inc: { hits: +1 },                     // increment a field
    $unset: { error: '' },                  // unset a field
    $setOnInsert: { ctime: new Date() },    // set on insert, not update
    $rename: { 'current': 'previous' }      // rename a field
}
```

The following operators are supported:

| Operator          | Comment                                                                                          |
|-------------------|--------------------------------------------------------------------------------------------------|
| `$set`            | Set the value of a field                                                                         |
| `$inc`            | Increment the value of a field by the specified amount. To decrement, use negative amounts       |
| `$unset`          | Remove the field (with some drivers: set it to `null`)                                           |
| `$setOnInsert`    | Set the value of a field only when a new entity is inserted (see `upsert` with [Model.updateQuery](#modelupdatequerycriteria-update-optionsq))      |
| `$rename`         | Rename a field                                                                                   |

Before querying, `MissyUpdate` uses `Converter` to convert the given field values to the DB types.
For instance, the `{ id: '1' }` criteria will be converted to `{ $set: { id: 1 } }`.

Example:

```js
var User = schema.define('User', {
    id: Number,
    mtime: Date,
    //...
});
User.updateQuery({ id: 1 }, { $set: { mtime: new Date(); } }) // update mtime without fetching
    .then(function(user){ ... });
```






Driver
======

Missy is a database abstraction and has no DB-specific logic, while *Drivers* implement the missing part.
A Driver is a class that implements the `IMissyDriver` interface (*lib/interfaces.js*).

Each driver is created with a *connecter* function: a function that returns a database client through a promise.
Missy does not handle it internally so you can specify all the necessary options and tune the client to your taste.

The first thing you start with is instantiating a driver.

```js
var missy = require('missy');

// For demo, we'll use `MemoryDriver`: it does not require any connecter function at all.
var memory = new missy.drivers.MemoryDriver();
```

Note: `MemoryDriver` is built into Missy, but is extremely slow: it's designed for unit-tests and not for production!

At the user level, you don't use the driver directly. However, it has two handy events:

```js
memory.on('connect', function(){
    console.log('Driver connected');
});

memory.on('disconnect', function(){
    console.log('Driver disconnected');
});
```

## Supported Drivers

Missy drivers are pluggable: just require another package, and you'll get a new entry under `missy.drivers`.

| Driver            | Database          | Package name                                                | Github                                            |
|-------------------|-------------------|-------------------------------------------------------------|---------------------------------------------------|
| `MemoryDriver`    | in-memory         | [missy](https://npmjs.org/package/missy)                    | built-in                                          |
| `PostgresDriver`  | PostgreSQL        | [missy-pg](https://npmjs.org/package/missy-pg)              | <https://github.com/kolypto/nodejs-missy-pg>      |
| `MongodbDriver`   | MongoDB           | [missy-mongodb](https://npmjs.org/package/missy-mongodb)    | <https://github.com/kolypto/nodejs-missy-mongodb> |

Contributions are welcome, provided your driver is covered with unit-tests :)






Schema
======

Source: [lib/Schema.js#Schema](lib/Schema.js)

The instantiated driver is useless on its own: you just pass it to the `Schema` object which is the bridge that connects
your *Models* with the Driver of your choice.

You're free to use multiple schemas with different drivers: Missy is smart enough to handle them all, *with no limitations*.

Note: a single driver can only be used with a single schema!

```js
var missy = require('missy');

// Create: Driver, Schema
var driver = new missy.drivers.MemoryDriver(),
    schema = new missy.Schema(driver, {});

// Initially, the schema is not connected

schema.connect()
    .then(function(){
        console.log('DB connected!');
    });
```


## Schema(driver, settings?)

Constructor. Creates a schema bound to a driver.

* `driver:IMissyDriver`: The driver to work with
* `settings:Object?`: Schema settings. An object:

    * `queryWhenConnected: Boolean`

        Determines how to handle queries on models of a disconnected schema.

        When `false` (default), querying on a disconnected schema throws `MissyDriverError`

        When `true`, the query is delayed until the driver connects.

    Source: [lib/options.js#SchemaSettings](lib/options.js)

Initially, the schema is not connected. Use `Schema.connect()` to make the driver connect.

## Schema.define(name, fields, options?):Model

Defines a model on the schema. The model uses the driver bound to the schema.

Note: you can freely define models on a schema that is not connected.

* `name:String`: Model name
* `fields:Object`: Model fields definition
* `options:Object?`: Model options

See: [Model Definition](#model-definition).

```js
schema.define('User', {
    id: Number,
    login: String
}, { pk: 'id' });
```

## Schema.registerType(name, TypeHandler):Schema

Register a custom [Type Handler](#type-handlers) on this schema. This type becomes available to all models
defined on the schema.

* `name: String`: The type handler name. Use it in model fields: `{ type: 'name' }`.
* `TypeHandler:IMissyTypeHandler`: The type handler class to use. Must implement `IMissyTypeHandler`

See: [Custom Type Handlers](#custom-type-handlers)

## Schema.connect():promise

Ask the driver to connect to the database.

Returns a promise.

```js
schema.connect()
    .then(function(){
        // DB connected
    })
    .catch(function(err){
        // DB connection error
    });
```

Note: once connected, the Schema automatically reconnects when the connection is lost.

## Schema.disconnect():promise

Ask the driver to disconnect from the database.

Returns: a promise

```js
schema.disconnect()
    .then(function(){
        // Disconnected
    });
```

Note: this disables automatic reconnects until you explicitly `connect()`.

## Schema.getClient():*

Convenience method to get the vanilla DB client of the underlying driver.

Handy when you need to make some complex query which is not supported by Missy.

See: [Using The Driver Directly](#using-the-driver-directly)






Model
=====

Source: [lib/Model.js#Model](lib/Model.js)

A *Model* is the representation of some database namespace: a table, a collection, whatever.
It defines the rules for a certain type of entity, including its fields and business-logic.



Model Definition
----------------
To define a `Model` on a `Schema`, you use [`schema.define()`](#schemadefinename-fields-optionsmodel):

```js
var missy = require('missy');

var driver = new missy.drivers.MemoryDriver(),
    schema = new missy.Schema(driver, {});

var User = schema.define('User', {
    id: Number,
    login: { type: String, required: true }
}, { pk: 'id' });
```

`Schema.define` accepts the following arguments:

* `name:String`: Model name.
* `fields:Object`: Model fields definition
* `options:Object?`: Model options

### Fields Definition

Source: [lib/interfaces.js#IModelFieldDefinition](lib/interfaces.js)

As stated in the [type handlers](#type-handlers) section, a field definition can be:

* A native JavaScript type (`String`, `Number`, `Date`, `Object`, `Array`)
* An object with the following fields:

    * `type:String`: Field type handler
    * `required:Boolean?`: Is the field required?

        A required field is handled differently by *type handlers*: it is now allowed to contain `null` and gets some
        default value determined by the *type handler*.

        Default value: uses `required` from [model options](#model-options).

    * `def:*|function(this:Model)`: The default value to use when the field is `undefined`.

        Can be either a value, or a function that returns a value.

        The default value is used when an entity is being saved to the DB, and the field value is either `undefined`,
        or `null` and having the `required=true` attribute.

### Model Options

Source: [lib/options.js#ModelOptions](lib/options.js)

* `table:String?`: the database table name to use.

    Default value: Missy casts the model name to lowercase and adds 's'.
    For instance, 'User' model will get the default table name of 'users'.

* `pk:String|Array.<String>?`: the primary key field name, or an array of fields for compound PK.

    Every model in Missy needs to have a primary key.

    Default value: `'id'`

* `required:Boolean?`: The default value for fields' `required` attribute.

    Default value: `false`

* `entityPrototype: Object?`: The prototype of all entities fetched from the database.

    This is the Missy way of adding custom methods to individual entities:

    ```js
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

    Wallet.findOne(1) // assuming there exists { uid: 1, amount: 100, currency: 'USD' }
        .then(function(wallet){
            console.log(wallet + ''); // -> 100 USD
        });
    ```



Helpers
-------

The following low-level model methods are available in case you need to manually handle
entities that were fetched or are going to be stored by [using the driver directly](#using-the-driver-directly):

### Model.getClient():Object
Returns the vanilla DB client from the Schema.

### Model.entityImport(entity):Q
Process an entity loaded from the DB like Missy does it:

* Invoke model hooks (see: [Model Hooks](#model-hooks))
* Use `Converter` to apply field types
* Assign entity prototypes (if configured)

Returns a promise for an entity.

```js
var Post = schema.define('Post', {
    id: Number,
    title: String,
    tags: Array
});

Post.entityImport({ id: '1', title: 1111, tags: 'test' })
    .then(function(entity){
        console.log(entity); // { id: 1, title: '1111', tags: ['test'] }
    });
```

### Model.entityExport(entity):Q

Process an entity loaded from the DB like Missy does it:

* Invoke model hooks (see: [Model Hooks](#model-hooks))
* Use `Converter` to apply field types

Returns a promise for an entity.



Operations
----------

### Read Operations

#### Model.get(pk, fields?):Q

#### Model.findOne(criteria?, fields?, sort?, options?):Q

#### Model.find(criteria?, fields?, sort?, options?):Q

#### Model.count(criteria?, options?):Q

### Write Operations

#### Model.insert(entities, options?):Q

#### Model.update(entities, options?):Q

#### Model.save(entities, options?):Q

#### Model.remove(entities, options?):Q

### Queries

#### Model.updateQuery(criteria, update, options?):Q
#### Model.removeQuery(criteria, options?):Q

### Using The Driver Directly

Missy search criteria is limited in order to keep the implementation simple. In order to make complex queries, you'll
need to use the Driver directly. You still can use Missy in this case.

Model Hooks
-----------

Relations
---------

### Defining Relations

#### Model.hasOne(prop, foreign, fields)
#### Model.hasMany(prop, foreign, fields)

### Handling Related Entities

#### Model.loadRelated(entities, prop, fields?, sort?, options?):Q
#### Model.saveRelated(entities, prop, options?):Q
#### Model.removeRelated(entities, prop, options?):Q
#### Model.withRelated(prop, ...):Model





Recipes
=======

Validation
----------
