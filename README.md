Jest
====

> JavaScriptational State Transfer for node.js with easy generating resource from Mongoose ORM

####  #

introduction
------------
This module provides Resource base class with:

- Authentication
- Authorization
- Pagination
- Cache
- Throttling
- Validation
- MongooseResource
- Resources listing

synopsis
--------
```js
var express = require('express'),
    app = express.createServer(),
    Jest = require('jest'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/app');
```

// create mongoose model

```js
var User = mongoose.model('user', new Schema({
    username: {type: String, required: true},
    email: String,
    password: {type: String, validate: [function(v) { return true}, 'custom validate']},
    credits: {type: Number, min: 1, max: 230},
    role: {type: String, 'default': 'user' ,enum: ['user', 'admin']},
    date: {type:Date, 'default': Date.now},
    groups: [{name:String, permissions: [{name:String, expires:Date}]}]
}));
```

// create mongoose resource for User model

```js
var UserResource = Jest.MongooseResource.extend({
    init: function(){
        // call Jest.Resource constructor
        // passing the Model User we created
        this._super(User);

        // use array to decide which fields will be visible by API
        // this.fields = ['username','credits'];
        // use tree object to decide recursively which fields to expose
        this.fields = {'username': true, 'credits': true, groups: {name: true, permissions: {name: true} }};

        // use list or
        this.update_fields = ['email', 'password'];

        // specify base query for the model
        this.default_query = function(query){
            return query.where('credits').gte(10);
        };

        // specify which fields can be used to filter
        this.filtering = {'credits': true};

        // which http methods are allowed
        this.allowed_methods = ['get', 'post', 'put'];
    }
})

var api = new Jest.Api('api', app);

api.register('users', new UserResource());
```

installation
------------

    $ npm install jest

documentation
-------------

There is none.
But there is an example, and a test.

And maybe one day will be...
