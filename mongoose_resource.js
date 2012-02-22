/**
 * Created by JetBrains WebStorm.
 * User: Ishai
 * Date: 14/02/12
 * Time: 18:56
 * To change this template use File | Settings | File Templates.
 */

var util = require('util'),
    validation = require('./validation');


var MongooseResource = exports.MongooseResource = function(model)
{
    MongooseResource.super_.call(this);
    this.model = model;
    this.default_filters = {};
    this.default_query = function(query)
    {
        return query;
    };
    //this.validation = new validation.MongooseValidation(model);
}

util.inherits(MongooseResource,require('./resource').Resource);

MongooseResource.prototype.get_object = function(req,id,callback)
{
    var query = this.model.findById(id);
    this.authorization.limit_object(req,query,function(err,query)
    {
        if(err) callback(err);
        else
        {
            query.exec(callback);
        }
    });
};

MongooseResource.prototype.get_objects = function(req,filters,sorts,limit,offset,callback)
{
    var self = this;
    var query = this.default_query(this.model.find(this.default_filters));
    var count_query = this.default_query(this.model.count(this.default_filters));

    for(var filter in filters)
    {
        var splt = filter.split('__');
        if(splt.length > 1)
        {
            query.where(splt[0])[splt[1]](filters[filter]);
            count_query.where(splt[0])[splt[1]](filters[filter]);
        }
        else
        {
            query.where(filter,filters[filter]);
            count_query.where(filter,filters[filter]);
        }
    }
    for(var i=0; i<sorts.length; i++)
        query.sort(sorts[i].field,sorts[i].type);
    query.limit(limit);
    query.skip(offset);
    var results = null, count = null;
    function on_finish()
    {
        if(results != null && count != null)
        {
            var final = {
                objects:results,
                meta:
                {
                    total_count:count,
                    offset:offset,
                    limit:limit
                }
            };
            callback(null,final);
        }
    }
    self.authorization.limit_object_list(req,query,function(err,query)
    {
        if(err) callback(err);
        else
            query.exec(function(err,objects)
            {
                if(err) callback(err);
                else
                {
                    results = objects;
                    on_finish();
                }
            });
    });
    this.authorization.limit_object_list(req,count_query,function(err,count_query)
    {
        if(err) callback(err);
        else
            count_query.exec(function(err,counter)
            {
                if(err) callback(err);
                else
                {
                    count = counter;
                    on_finish();
                }
            });
    });
};

MongooseResource.prototype.create_obj = function(req,fields,callback)
{
    var self = this;
    var object = new self.model();
    for( var field in fields)
    {
        object.set(field,fields[field]);
    }
    self.authorization.edit_object(req,object,function(err,object)
    {
        if(err) callback(err);
        else
        {
            object.save(function(err,object)
            {
                callback(self.elaborate_mongoose_errors(err),object);
            });
        }
    });
};

MongooseResource.prototype.update_obj = function(req,object,callback)
{
    var self = this;
    self.authorization.edit_object(req,object,function(err,object)
    {
        if(err) callback(err);
        else
        {
            object.save(function(err,object)
            {
                callback(self.elaborate_mongoose_errors(err),object);
            });
        }
    });
};

MongooseResource.prototype.delete_obj = function(req,object,callback)
{
    object.delete(function(err)
    {
        if(err) callback(err);
        else
            callback(null,{});
    });
};

MongooseResource.prototype.elaborate_mongoose_errors = function(err)
{
    if(err && err.errors)
    {
        for(var error in err.errors)
        {
             err.errors[error] = validation.elaborate_mongoose_error(this.model,error,err.errors[error]);
        }
    }
    return err;
};