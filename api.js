var util = require('util');

var DEFAULT_LIMIT = 20;
var MAX_LIMIT = 400;

exports.register_resource = function(resource)
{
	return {
		show : function(req,res) { return resource.show(req,res); },
		index : function(req,res) { return resource.index(req,res); },
		new : function(req,res) { return resource.new(req,res); },
		edit : function(req,res) { return resource.edit(req,res); },
		create : function(req,res) { return resource.create(req,res); },
		update : function(req,res) { return resource.update(req,res); },
		delete : function(req,res) { return resource.delete(req,res); }
	};
}

var NotImplemented = function()
{

};

var Authentication = function() {};

// does the request is authenticated, callback false will return 401
Authentication.prototype.is_authenticated = function(req,callback) { callback(null,true); }

// get a request identifier, uses for throtelling (optional)
Authentication.prototype.get_request_identifier = function(req) { return req.connection.remoteAddress; }

var Authorization = function() {};

// is request is authorized, callback false will return 401
Authorization.prototype.is_authorized = function(req,callback) { callback(null,true); };

// limit an object list to only allow authorized data
Authorization.prototype.limit_object_list = function(req,objects,callback)
{
    callback(null,objects);
};

// limit single object, callback(null,object) to allow, callback(null,null) to block
Authorization.prototype.limit_object = function(req,object,callback)
{
    callback(null,object);
};

Authorization.prototype.edit_object = function(req,object,callback)
{
    // edits an object right before it's being saved
    callback(null,object);
};

var Cache = function() {};

Cache.prototype.get = function(key,callback) { callback(null,null)};

Cache.prototype.set = function(key,value,callback) { callback(null) };

var Validation = function() {};

Validation.prototype.is_valid = function(json,callback)
{
   callback(null,{});  
};

var Throttling = function() { };

Throttling.prototype.throttle = function(identifier,callback)
{
    callback(null,false);
};

var Resource = function()
{
    this.allowed_methods = ['get'];
    this.authentication = new Authentication();
    this.authorization = new Authorization();
    this.cache = new Cache();
    this.validation = new Validation();
    this.throttling = new Throttling();
    this.filtering = [];
    this.update_fields = null;
};

Resource.prototype.load = function(req,id,fn)
{
    req._id = id;
    fn(null,id);
};

Resource.prototype.internal_error = function(err,req,res)
{
    res.send(err.message,500);
}

Resource.prototype.dispatch = function(req,res,func)
{
    var self = this;
    // check if method is allowed
    var method = req.method.toLowerCase();
    if( !method in this.allowed_methods)
    {
        util.unauthorized(res);
        return;
    }
    // check authentication
    self.authentication.is_authenticated(req,function (err,is_auth)
    {
        if(err)
            self.internal_error(err,req,res);
        else
        {
            if(!is_auth)
            {
                util.unauthorized(res);
                return;
            }

            // check throttleing
            self.throttling.throttle(self.authentication.get_request_identifier(req),function(err,is_throttle)
            {
                if(err)
                {
                    self.internal_error(err,req,res);
                    return;
                }
                if(is_throttle)
                {
                    util.unautorized(res);
                    return;
                }
                self.authorization.is_authorized(req,function(err,is_auth)
                {
                    if(err)
                    {
                        self.interal_error(err,req,res);
                        return;
                    }

                    if(!is_auth)
                    {
                        util.unauthorized(res);
                        return;
                    }
                    func(req,function(err,response_obj)
                    {
                        if(err)
                        {
                            if(err.code)
                            {
                                res.json(err.message,err.code);
                            }
                            else
                                self.internal_error(err,req,res);
                            return;
                        }
                        var status;
                        switch(method)
                        {
                            case 'get':
                                status = 200;
                                break;
                            case 'post':
                                status = 201;
                                break;
                            case 'put':
                                status = 204;
                                break;
                            case 'delete':
                                status = 203;
                                break;
                        }
                        res.json(response_obj,status);
                    });
                });

            });

        }

    });
};

Resource.prototype.build_filters = function(query)
{
    var filters = {};
    for(var field in query)
    {
        if(field in this.filtering)
            filters[field] = query[field];
    }
    return filters;
};

Resource.prototype.build_sorts = function(query)
{
   return [];
};


Resource.prototype.cached_get_object = function(req,id,callback)
{
    var self = this;
    // get from cache
    this.cache.get(id,function(err,object)
    {
       if(err)
       {
           callback(err);
           return;
       }
       // if returned from cache return it
       if(object) callback(null,object);
       else 
           self.get_object(req,id,function(err,object)
           {
               if(err) callback(err);
               else
               {
                   self.cache.set(id,object,function() {});
                   callback(null,object);
               }
           });
    });
};

Resource.prototype.show = function(req,res)
{
    var self = this;
    return this.dispatch(req,res,function(req,callback)
    {
        self.cached_get_object(req,req._id,callback);
    });
};


Resource.prototype.index = function(req,res)
{
    var self = this;
    return this.dispatch(req,res,function(req,callback)
    {
        var filters = self.build_filters(req.query);
        var sorts = self.build_sorts(req.query);
        var cached_key = (req.url + '?').split('?')[1];
        var offset = req.query['offfset'] || 0;
        var limit = req.query['limit'] || DEFAULT_LIMIT;
        limit = Math.min(limit,MAX_LIMIT);
        self.cache.get(cached_key,function(err,objects)
        {
            if(err) callback(err);
            else
            {
                if(objects)
                    callback(null,objects);
                else
                    self.get_objects(req,filters,sorts,limit,offset,callback);

            }
        });
    });
};

Resource.prototype.limit_update_fields = function(req,callback)
{
    var full = '';
    var self = this;
    req.on('data',function(data) { full += data; });
    req.on('end',function()
    {
        var json =  JSON.parse(full);
        if(!self.update_fields)
            callback(null,json);
        else
        {
            var new_json = {};
            for( var field in json)
            {
                if(field in self.update_fields)
                    new_json[field] = json[field];
            }
            callback(null,new_json);
        }
    });
};

Resource.prototype.create = function(req,res)
{
    var self = this;
    return this.dispatch(req,res,function(req,callback)
    {
        // get request fields and limit them
        self.limit_update_fields(req,function(err,fields)
        {
            if(err)
            {
                callback(err);
                return;
            }
            // validate fields
            self.validation.is_valid(fields,function(err,errors)
            {
                if(err) callback(err);
                else
                {
                    if(errors && Object.keys(errors).length > 0)
                    {
                        callback({code:400,message:errors,content:'json'});
                    }
                    else
                    {
                        // save objects
                        self.create_obj(req,fields,function(err,object)
                        {
                            if(err) callback(err);
                            else
                            {
                                // save to cache (no need to wait for response)
                                self.cache.set(req._id,object,function() {});
                                callback(null,object);
                            }
                        });
                    }
                }
            });
        });
    });
};

Resource.prototype.update = function(req,res)
{
    return this.dispatch(req,res,function(req,callback)
    {
        this.get_object(req,req._id,function(err,object)
        {
            if(err) callback(err);
            else
            {
                // get request fields and limit them
                var fields = this.limit_update_fields(req);
                // validate fields
                this.validation.is_valid(fields,function(err,errors)
                {
                    if(err) callback(err);
                    else
                    {
                        if(errors && errors != {} && errors != [])
                        {
                            callback({code:400,message:errors,content:'json'});
                        }
                        else
                        {
                            this.update_obj(object,fields,function(err,object)
                            {
                                if(err)
                                    callback(err);
                                else
                                {
                                    // save to cache, this time wait for response
                                    this.cache.set(req._id,object,function(err)
                                    {
                                       if(err) callback(err);
                                       else callback(null,object);
                                    });
                                }
                            });
                        }
                    }
                });           // save objects
            }
        });
    });
};

Resource.prototype.delete = function(req,res)
{
    return this.dispatch(req,res,function(req,callback) {
        this.get_object(req,req._id,function(err,object)
        {
            if(err) callback(err);
            else
            {
                this.delete_obj(object,callback);
                this.cache.set(req._id,null,function() {});
            }
        });
    });
};

Resource.prototype.get_object = function(id,callback)
{
    throw new NotImplemented();
}

Resource.prototype.get_objects = function(filters,sorts,limit,offset,callback)
{
    throw new NotImplemented();
};

Resource.prototype.create_obj = function(req,fields,callback)
{
    throw new NotImplemented();
};

Resource.prototype.update_obj = function(object,fields,callback)
{
    throw new NotImplemented();
};

Resource.prototype.delete_obj = function(object,callback)
{
    throw new NotImplemented();
};

var MongooseResource = function(model,default_filters)
{
    MongooseResource.super_.call(this);
    this.model = model;
    this.default_filters = default_filters || {};
}

util.inherits(MongooseResource,Resource);

MongooseResource.prototype.get_object = function(req,id,callback)
{
   var query = this.model.findById(id,function(err,object)
   {
       console.log(object);
   });
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
    var query = this.model.find(this.default_filters);
    var count_query = this.model.count(this.default_filters);
    query.where(filters);
    count_query.where(filters);
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
    query.exec(function(err,objects)
    {
        if(err) callback(err);
        else
        {
            results = objects;
            on_finish();
        }
    });
    count_query.exec(function(err,counter)
    {
       if(err) callback(err);
        else
       {
           count = counter;
           on_finish();
       }
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
           object.save(callback);
        }
    });
};



exports.Resource = Resource;

exports.MongooseResource = MongooseResource;

exports.Authentication = Authentication;

exports.Authorization = Authorization;

exports.Cache = Cache;

exports.Validation = Validation;

exports.Throttling = Throttling;
