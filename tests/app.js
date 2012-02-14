var express = require('express')
    , Resource = require('express-resource')
    , util = require('util')
    , api = require('../api')
    , resources = require('../mongoose_resource')
    , cache = require('../cache')
    , app = express.createServer();

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var util = require('util');

mongoose.connect('mongodb://localhost/test_api_db');


// create mongoose model
var User = mongoose.model('user', new Schema({
    username: {type:String,required:true},
    email: String,
    password : {type:String,validate:[function(v) { return true},'custom validate']},
    index:{type:Number, min:3, max:230},
    role:{type:String, 'default' :'user' ,enum:['user','admin']},
    date: {type:Date,'default':Date.now}
}));

// create api with path
var rest_api = new api.Api('/api/',app);


var MemoryCache  = function() {
    this.mem = {};
};
util.inherits(MemoryCache,cache.Cache);

MemoryCache.prototype.get = function(key,callback)
{
    callback(null,this.mem[key]);
};

MemoryCache.prototype.set = function(key,value,callback)
{
    this.mem[key] = value;
    callback();
};

// create mongoose-resource for User model
var UserResource = function()
{
    UserResource.super_.call(this,User);
    this.fields = ['username','index'];
    this.default_query = function(query)
    {
        return query.where('index').gte(10);
    };
    this.filtering = {'index':0};
    this.allowed_methods = ['get','post','put'];
    //this.cache = new MemoryCache();
};

util.inherits(UserResource,resources.MongooseResource);

// register resource to api
rest_api.register_resource('users',new UserResource());


app.listen(80);

function drop_database(callback)
{
    mongoose.connection.db.executeDbCommand( {dropDatabase:1}, function(err,
                                                                        result) {

        if(err)
        {
            console.log(err);
            callback(err);
        }
        else
        {
            callback(null,result);
        }
    });
}


console.log('dropping db');
setInterval(function() {
drop_database(function(err)
{
    console.log('dropped');
    console.log('running tests');
    require('./tests').run(function()
    {
        console.log('dropping db');
        drop_database(function(err)
            {
                console.log('done');
                process.exit(0);
            }
        );
    });
})
},2000);
