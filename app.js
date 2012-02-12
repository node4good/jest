var express = require('express')
  , Resource = require('express-resource')
  , util = require('util')
  , app = express.createServer();

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/xperiences');

var User = mongoose.model('auth_user', new Schema({
    username: String,
    email: String,
    password : String
}));

var rest_api = require('./api');

var UserResource = function()
{
    UserResource.super_.call(this,User);
};

util.inherits(UserResource,rest_api.MongooseResource);


//var TestResource = require('./resources').TestResource;

app.resource('users', rest_api.register_resource(new UserResource()));

app.listen(80);