/**
 * Created by JetBrains WebStorm.
 * User: Ishai
 * Date: 14/02/12
 * Time: 18:50
 * To change this template use File | Settings | File Templates.
 */
var util = require('util');

var Authorization = exports.Authorization = function() {};

// is request is authorized, callback false will return 401
Authorization.prototype.is_authorized = function(req,callback) { callback(null,true); };

// USED ONLY WITH MONGOOSE RESOURCE
// limit an object list to only allow authorized data
Authorization.prototype.limit_object_list = function(req,objects,callback)
{
    // add further filter on object list
    callback(null,objects);
};

// USED ONLY WITH MONGOOSE RESOURCE
// limit single object, callback(null,object) to allow, callback(null,null) to block
Authorization.prototype.limit_object = function(req,object,callback)
{
    callback(null,object);
};

// USED ONLY WITH MONGOOSE RESOURCE
Authorization.prototype.edit_object = function(req,object,callback)
{
    // edits an object right before it's being saved
    callback(null,object);
};

var MongooseAuthorization = exports.MongooseAuthorization = function(user_field)
{
    MongooseAuthorization.super_.call(this);
    this.user_field = user_field;
};
util.inherits(MongooseAuthorization,Authorization);

MongooseAuthorization.prototype.get_user_id = function(req)
{
    return null;
};

MongooseAuthorization.prototype.limit_object_list = function(req,query,callback)
{
    var user_id = this.get_user_id(req);
    if(!user_id)
        callback({message:'cant get user id'});
    else
    {
        query.where(this.user_field,user_id);
        callback(null,query);
    }
};

MongooseAuthorization.prototype.limit_object = function(req,object,callback)
{
    var user_id = this.get_user_id(req);
    if(!user_id)
        callback({message:'cant get user id'});
    else
    {
        object.set(this.user_field,user_id);
        callback(null,object);
    }
};

MongooseAuthorization.prototype.edit_object = function(req,object,callback)
{
    var user_id = this.get_user_id(req);
    if(!user_id)
        callback({message:'cant get user id'});
    else
    {
        object.set(this.user_field,user_id);
        callback(null,object);
    }
};