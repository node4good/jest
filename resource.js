var util = require('util'),
    authentication = require('./authentication'),
    authorization = require('./authorization'),
    cache = require('./cache'),
    throttling = require('./throttling'),
    validation = require('./validation');

exports.DEFAULT_LIMIT = 20;
exports.MAX_LIMIT = 500;

var NotImplemented = function()
{

};

var Resource = exports.Resource = function()
{
    // allowed methods tree
    this.allowed_methods = {'get':null};
    this.authentication = new authentication.Authentication();
    this.authorization = new authorization.Authorization();
    this.cache = new cache.Cache();
    this.validation = new validation.Validation();
    this.throttling = new throttling.Throttling();
    this.filtering = {};
    this.update_fields = null;
    this.fields = null;
    this.default_limit = null;
    this.max_limit = null;
};

Resource.prototype.load = function(req,id,fn)
{
    req._id = id;
    fn(null,id);
};

Resource.prototype.internal_error = function(err,req,res)
{
    res.send(err.message || '',500);
};

Resource.prototype.full_dehydrate = function(objs)
{
    if(typeof(objs) == 'object' && 'meta' in objs && 'objects' in objs)
    {
        objs.objects = this.dehydrate(objs.objects);
        return objs;
    }
    else
        return this.dehydrate(objs);
};

Resource.prototype.get_allowed_methods_tree = function()
{
    if(!this.allowed_methods)
        return null;
    if(Array.isArray(this.allowed_methods))
    {
        var new_tree = {};
        for(var i=0; i<this.allowed_methods.length; i++)
        {
            new_tree[this.allowed_methods[i]] = null;
        }
        this.allowed_methods = new_tree
    }
    return this.allowed_methods;
};

Resource.prototype.get_tree = function()
{
    if(!this.tree && this.fields)
    {
        if(Array.isArray(this.fields))
        {
            this.tree = {};
            for(var i=0; i<this.fields.length; i++)
            {
                this.tree[this.fields[i]] = null;
            }
        }
        else
            this.tree = this.fields;
    }
    return this.tree;
};

Resource.prototype.get_update_tree = function()
{
    if(!this.update_tree && this.update_fields)
    {
        if(Array.isArray(this.update_fields))
        {
            this.update_tree = {};
            for(var i=0; i<this.update_fields.length; i++)
            {
                this.update_tree[this.update_fields[i]] = null;
            }
        }
        if(typeof(this.update_fields) == 'object')
            this.update_tree = this.update_fields;
    }
    return this.update_tree;
};

Resource.prototype.dehydrate_number = function(num) { return Number(num); };

Resource.prototype.dehydrate_date = function(date) { return Date(date); };

Resource.prototype.dehydrate = function(object,tree)
{
    if(Array.isArray(object))
    {
        var objects = [];
        for(var i=0; i<object.length; i++)
        {
            objects.push(this.dehydrate(object[i],tree));
        }
        return objects;
    }
    if(typeof(object) != 'object')
        return object;

    if(object instanceof Number)
        return this.dehydrate_number(object);
    if( object instanceof Date)
        return this.dehydrate_date(object);

    if(!tree)
        tree = this.get_tree();
    if(!tree)
        return object;
    var new_object = {};
    for(var field in tree)
    {
        if(typeof(object.get) == 'function')
            new_object[field] = this.dehydrate(object.get(field),tree[field]);
        else
            new_object[field] = this.dehydrate(object[field],tree[field]);
    }
    return new_object;
};

Resource.prototype.deserialize = function(req,res,object,status)
{
    // TODO negotiate response content type
    res.json(object,status);
}


Resource.prototype.dispatch = function(req,res,func)
{
    var self = this;
    // check if method is allowed
    var method = req.method.toLowerCase();
    if(!( method in this.get_allowed_methods_tree()))
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
                    util.unauthorized(res);
                    return;
                }
                self.authorization.is_authorized(req,function(err,is_auth)
                {
                    if(err)
                    {
                        self.internal_error(err,req,res);
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
                        response_obj = self.full_dehydrate(response_obj);
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
                        self.deserialize(req,res,response_obj,status);
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
        if(field.split('__')[0] in this.filtering)
            filters[field] = query[field];
        if(field.split('__').length > 1 && field.split('__')[1] == 'in')
            filters[field] = query[field].split(',');
    }
    return filters;
};

Resource.prototype.build_sorts = function(query)
{
    var sorting = query['order_by'];
    if(sorting)
    {
        sorting = sorting.split(',');
        var sorts = [];
        for(var i=0; i<sorting.length; i++)
        {
            var asec = sorting[i][0] != '-';
            if( sorting[i][0] == '-')
                sorting[i] = sorting[i].substr(1);

           sorts.push({field:sorting[i],type:asec?1:-1});
        }
        return sorts;
    }
    return [];
};

Resource.prototype.build_cache_key = function(id_query)
{
    var key = id_query;
    if(typeof(id_query) == 'object')
    {
        key = '';
        for(var field in id_query)
            key += field + '=' +id_query[field];

    }
    key = this.path + key;
    return key;
};


Resource.prototype.cached_get_object = function(req,id,callback)
{
    var self = this;
    // get from cache
    var cache_key = self.build_cache_key(id);
    this.cache.get(cache_key,function(err,object)
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
                    self.cache.set(cache_key,object,function() {});
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
        var cached_key = self.build_cache_key(req.query);
        var offset = Number(req.query['offset'] || 0);
        var limit = Number(req.query['limit'] || self.default_limit || exports.DEFAULT_LIMIT);
        limit = Math.min(limit,self.MAX_LIMIT || exports.MAX_LIMIT);
        self.cache.get(cached_key,function(err,objects)
        {
            if(err) callback(err);
            else
            {
                if(objects)
                    callback(null,objects);
                else
                    self.get_objects(req,filters,sorts,limit,offset,function(err,objects)
                    {
                        if(err) callback(err);
                        else
                        {
                            self.cache.set(cached_key,objects,function(err) {});
                            callback(null,objects);
                        }
                    });

            }
        });
    });
};

Resource.prototype.hydrate = function(object,tree)
{
    if(Array.isArray(object))
    {
        var objects = [];
        for(var i=0; i<object.length; i++)
        {
            objects.push(this.hydrate(object[i],tree));
        }
        return objects;
    }
    if(typeof(object) != 'object')
        return object;
    if(!tree)
        tree = this.get_update_tree();
    if(!tree)
        return object;
    var new_object = {};
    for(var field in tree)
        new_object[field] = this.hydrate(object[field],tree[field]);
    return new_object;
}

Resource.prototype.limit_update_fields = function(req,callback)
{
    var full = '';
    var self = this;
    var json = req.body;
    return self.hydrate(json);
};

Resource.prototype.create = function(req,res)
{
    var self = this;
    return this.dispatch(req,res,function(req,callback)
    {
        // get request fields and limit them
        var fields = self.limit_update_fields(req);

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
                            self.cache.set(self.build_cache_key(object.id),object,function() {});
                            callback(null,object);
                        }
                    });
                }
            }
        });
    });
};

Resource.prototype.update = function(req,res)
{
    var self = this;
    return self.dispatch(req,res,function(req,callback)
    {
        self.get_object(req,req._id,function(err,object)
        {
            if(err) callback(err);
            else
            {
                // get request fields and limit them
                var fields = self.limit_update_fields(req);

                for(var field in fields)
                {
                    object.set(field,fields[field]);
                }
                // validate fields
                self.validation.is_valid(object,function(err,errors)
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
                            self.update_obj(req,object,function(err,object)
                            {
                                if(err)
                                    callback(err);
                                else
                                {
                                    // save to cache, this time wait for response
                                    self.cache.set(self.build_cache_key(req._id),object,function(err)
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
                this.cache.set(self.build_cache_key(req._id),null,function() {});
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

Resource.prototype.update_obj = function(req,object,callback)
{
    throw new NotImplemented();
};

Resource.prototype.delete_obj = function(object,callback)
{
    throw new NotImplemented();
};
