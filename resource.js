var _ = require('underscore'),
    Class = require('sji'),
    Authentication = require('./authentication'),
    Authorization = require('./authorization'),
    Cache = require('./cache'),
    Throttling = require('./throttling'),
    Validation = require('./validation');

var NotImplemented = Class.extend({
    init:function () {
    }
});

var Resource = module.exports = Class.extend({
    /**
     * constructor
     */
    init:function () {
        // allowed methods tree, can contain 'get','post','put','delete'
        this.allowed_methods = ['get'];
        // the authentication class to use (default:no authentication)
        this.authentication = new Authentication();
        // the authorization class to use (default: no authorization)
        this.authorization = new Authorization();
        // cache mechanizem ( default:no cache)
        this.cache = new Cache();
        // validation mechanizem (default: no validation)
        this.validation = new Validation();
        // throttling engine (default: no throttling)
        this.throttling = new Throttling();
        // fields uppon filtering is allowed
        this.filtering = {};
        // fields uppon sorting is allowed
        this.sorting = null;
        // fields that can be updated/created
        this.update_fields = null;
        // fields than can't be updated (stronger)
        this.update_exclude_fields = null;
        // fields which are exposable
        this.fields = null;
        // default quering limit
        this.default_limit = null;
        // max results to return
        this.max_limit = null;
		// TBD
		this.strict = false;
    },

    /**
     * called on GET - /<resource>/:resource_id
     *
     * @param req
     * @param res
     */
    show:function (req, res) {
        var self = this;

        return self.dispatch(req, res, function (req, callback) {
            // get the object by id
            self.cached_get_object(req, req._id, function(err,object){
				if(err)
					callback(err);
				else
				{
					if(!object)
						callback({code:404,message:'couldn\'t find object with id ' + req._id});
					else
						callback(null,object);
				}
			});
        });
    },

    /**
     * called on GET - /<resource>/
     *
     * @param req
     * @param res
     */
    index:function (req, res) {
        var self = this;

        return self.dispatch(req, res, function (req, callback) {
            // parse query params
            var filters = self.build_filters(req.query);
            var sorts = self.build_sorts(req.query);
            if(typeof(filters) == 'string' || typeof(sorts) == 'string')
            {
                callback({code:400,message:filters});
                return;
            }
            var offset = Number(req.query['offset'] || 0);
            var limit = Number(req.query['limit'] || self.default_limit || self.settings.DEFAULT_LIMIT);
            var max_limit = self.max_limit || self.settings.MAX_LIMIT;
            if(limit >= max_limit)
            {
                if(self.strict)
                    callback({code:400, message:'limit can be more than ' + max_limit})
                else
                    limit = max_limit;
            }
            limit = Math.min(limit, self.max_limit || self.settings.MAX_LIMIT);
            if (limit <= 0)
            {
                if(self.strict)
                    callback({code:400, message:'limit must be a greater than zero'});
                else
                    limit = self.max_limit || self.settings.MAX_LIMIT;
            }

            // check if in cache
            var cached_key = self.build_cache_key(req.query);
            self.cache.get(cached_key, function (err, objects) {
                if (err) callback(err);
                else {
                    // if in cache, returns cached results
                    if (objects)
                        callback(null, objects);
                    else
                    //  if not get from DB
                        self.get_objects(req, filters, sorts, limit, offset, function (err, objects) {
                            if (err) callback(err);
                            else {
                                // set in cache. don't wait for response
                                self.cache.set(cached_key, objects, function (err) {
                                });
                                callback(null, objects);
                            }
                        });

                }
            });
        });
    },

    /**
     * called on POST - /<resource>/
     *
     * @param req
     * @param res
     */
    create:function (req, res) {
        var self = this;
        return self.dispatch(req, res, function (req, callback) {
            // get request fields, parse & limit them
            var fields = self.hydrate(req.body,self.get_update_tree(req), self.get_update_exclude_tree(req));

            // validate object
            self.validation.is_valid(fields, function (err, errors) {
                if (err) callback(err);
                else {
                    if (errors && Object.keys(errors).length > 0) {
                        callback({code:400, message:errors, content:'json'});
                    }
                    else {
                        // save objects
                        self.create_obj(req, fields, callback);
                    }
                }
            });
        });
    },

    /**
     * called on PUT - /<resource>/:resource_id
     *
     * @param req
     * @param res
     */
    update:function (req, res) {
        var self = this;
        return self.dispatch(req, res, function (req, callback) {
            // get the object by the url id
            self.get_object(req, req._id, function (err, object) {
                if (err) callback(err);
                else {
					if(!object)
					{
						callback({code:404,message:'object doesn\'t exists'});
						return;
					}

                    // get request fields, parse & limit them
                    var fields = self.hydrate(req.body,self.get_update_tree(req), self.get_update_exclude_tree(req));

                    self.setValues(object,fields);

                    // validate object
                    self.validation.is_valid(object, function (err, errors) {
                        if (err) callback(err);
                        else {
                            if (errors && Object.keys(errors).length > 0) {
                                callback({code:400, message:errors, content:'json'});
                            }
                            else {
                                // save the modified object
                                self.update_obj(req, object, function (err, object) {
                                    if (err)
                                        callback(err);
                                    else {
                                        // save to cache, this time wait for response
                                        self.cache.set(self.build_cache_key(req._id), object, function (err) {
                                            if (err) callback(err);
                                            else callback(null, object);
                                        });
                                    }
                                });
                            }
                        }
                    });
                }
            });
        });
    },

    /**
     * called on DELETE - /<resource>/:resource_id
     *
     * @param req
     * @param res
     */
    destroy:function (req, res) {
        var self = this;

        return self.dispatch(req, res, function (req, callback) {
            // get the object to delete by the url id
            self.get_object(req, req._id, function (err, object) {
                if (err) callback(err);
                else {
					if(!object)
					{
						callback({code:404,message:'object doesn\'t exists'});
						return;
					}
                    // delete the object from DB
                    self.delete_obj(req, object, callback);
                    // delete the object from cache
                    self.cache.set(self.build_cache_key(req._id), null, function () {
                    });
                }
            });
        });
    },

    /**
     * Sets values from fields in object
     * @param object
     * @param fields
     */
    setValues:function(object,fields) {
        // updates the object with the given fields
        for (var field in fields) {
            // if the value is an object, not an array, extend recursively
            if(fields[field] && typeof(fields[field]) == 'object' && !Array.isArray(fields[field])) {
                if(!object[field])
                    object[field] = fields[field];
                else
                    this.setValues(object[field],fields[field]);
            }
            else {
                if (typeof(object.set) == 'function')
                    object.set(field, fields[field]);
                else
                    object[field] = fields[field];
            }
        }
    },

    /**
     * set the entity id on request._id
     *
     * @param req
     * @param id
     * @param fn
     */
    load:function (req, id, fn) {
        req._id = id;
        fn(null, id);
    },

    /*****************************     Error Responses   ******************************************
     *
     */

    /**
     * send unautherized response
     *
     * @param res
     * @param message
     */
    unauthorized:function (res, message) {
        if (message)
            res.send(message, 401);
        else
            res.send(401);
    },

    /**
     * send bad request response
     *
     * @param res
     * @param json
     */
    bad_request:function (res, json) {
        res.json(json.message || json, 400);
    },

    /**
     * send internal server error response
     *
     * @param err
     * @param req
     * @param res
     */
    internal_error: function(err, req, res) {
    	var message = (err.message || err);
    	var code = (err.code || 500);
        console.trace("jest internal error: " + message);
        res.send(message, code);
    },

    /*****************************     Help functions   ******************************************
     *
     */

    /**
     * gets the allowed methods object
     */
    get_allowed_methods_tree: function () {
        if(_.isArray(this.allowed_methods)){
            var tree = {};
            _.each(this.allowed_methods, function(method){

                if(method == 'get')
                    tree[method] = { 'details':true, 'list':true };
                else
                    tree[method] = true;
            });

            this.allowed_methods = tree;
        }

        return this.allowed_methods;
    },

    make_field_tree:function(fields)
    {
        var tree = null;
        if (fields) {
            if (Array.isArray(fields)) {
                tree = {};
                for (var i = 0; i < fields.length; i++) {
                    tree[fields[i]] = null;
                }
            }
            else
                tree = fields;
        }
        return tree;
    },

    /**
     * gets the exposable fields tree
     */
    get_tree:function (req) {
        var fields = req.jest_fields || this.fields;
        return this.make_field_tree(fields);
    },

    /**
     * gets the editable fields tree
     */
    get_update_tree:function (req) {
        var fields = req.jest_update_fields || this.update_fields;
        return this.make_field_tree(fields);
    },

    get_update_exclude_tree: function(req){
        var fields = req.jest_update_exclude_fields || this.update_exclude_fields;
        return this.make_field_tree(fields);
    },

    /**
     * goes over response objects & hide all fields that aren't in this.fields. Turns all objects to basic types (Number,String,Array,Object)
     *
     * @param objs
     */
    full_dehydrate:function (req,objs) {
        if (objs && typeof(objs) == 'object' && 'meta' in objs && 'objects' in objs) {
            objs.objects = this.dehydrate(objs.objects,this.get_tree(req));
            return objs;
        }
        else
            return this.dehydrate(objs,this.get_tree(req));
    },
    /**
     * same as full_dehydrate
     *
     * @param object
     * @param tree
     */
    dehydrate:function (object, tree,parent_object) {
        if(!object)
            return object;
        // if an array -> dehydrate each object independently
        if (Array.isArray(object)) {
            var objects = [];
            for (var i = 0; i < object.length; i++) {
                objects.push(this.dehydrate(object[i], tree,parent_object));
            }
            return objects;
        }
        if(typeof(object) == 'function')
            return object.call(parent_object);
        // if basic type return as is
        if (typeof(object) != 'object')
            return object;

        // parse known types
        if (object instanceof Number)
            return this.dehydrate_number(object);
        if (object instanceof Date)
            return this.dehydrate_date(object);

        // object is a dict {}

        // gets the exposeable fields tree
        if (!tree)
            return object;
        var new_object = {};
        for (var field in tree) {
            // recursively dehydrate children
            if (typeof(object.get) == 'function')
                new_object[field] = this.dehydrate(object.get(field) || object[field], tree[field],object);
            else
                new_object[field] = this.dehydrate(object[field], tree[field],object);
        }
        return new_object;
    },

    /**
     * parse number
     *
     * @param num
     */
    dehydrate_number:function (num) {
        return Number(num);
    },

    /**
     * parse date
     *
     * @param date
     */
    dehydrate_date:function (date) {
        return date;
    },

    deserializeJsonp: function(req,res,object,status) {
        res.header('Cache-Control','no-cache');
        res.header('Pragma','no-cache');
        res.header('Expires','-1');
        res.jsonp(object, status);
    },

    deserializeJson : function(req,res,object,status) {
        res.header('Cache-Control','no-cache');
        res.header('Pragma','no-cache');
        res.header('Expires','-1');
        res.json(object, status);
    },


    /**
     * converts response basic types object to response string
     *
     * @param req
     * @param res
     * @param object
     * @param status
     */
    deserialize:function (req, res, object, status) {
        // TODO negotiate response content type
        // Check if callback is defined. If so then respond jsonp
        var callback = req.query.callback || req.body.callback;

        if(callback) {
            this.deserializeJsonp(req, res, object, status);
            return;
        }

        this.deserializeJson(req, res, object, status);

    },

    /**
     * performs all API routeen checks before calling 'func', getting 'func' callback with object, and handles response object
     *
     * @param req
     * @param res
     * @param main_func
     */
    dispatch:function (req, res, main_func) {
        var self = this;
        // check if method is allowed
        var method = req.method.toLowerCase();
        var allowed_methods = self.get_allowed_methods_tree();
        if (!( method in allowed_methods )) {
            self.unauthorized(res);
            return;
        }
        else
        {
            if(allowed_methods[method] == 'get')
            {
                var is_list = req._id ? 'details' : 'list';
                if(!(is_list in allowed_methods))
                {
                    self.unauthorized(res);
                    return;
                }
            }
        }
        // check authentication
        self.authentication.is_authenticated(req, function (err, is_auth) {
            if (err)
                self.internal_error(err, req, res);
            else {
                if (!is_auth) {
                    self.unauthorized(res,'not authenticated');
                    return;
                }

                // check throttleing
                self.throttling.throttle(self.authentication.get_request_identifier(req), function (err, is_throttle) {
                    if (err) {
                        self.internal_error(err, req, res);
                        return;
                    }
                    if (is_throttle) {
                        self.unauthorized(res);
                        return;
                    }
                    self.authorization.is_authorized(req, function (err, is_auth) {
                        if (err) {
                            self.internal_error(err, req, res);
                            return;
                        }

                        if (!is_auth) {
                            self.unauthorized(res);
                            return;
                        }
                        // main function
                        main_func(req, function (err, response_obj) {
                            if (err) {
                                // error can be with error code
                                if (err.code) {
                                    if (err.code == 500) {
                                        self.internal_error(err, req, res);
                                    }
                                    else if (err.code == 400) {
                                        self.bad_request(res, err);
                                    }
                                    else if (err.code == 401) {
                                        self.unauthorized(res, err.message);
                                    }
                                    else if (err.message && err.message.match(/duplicate key/gi)) {
                                        res.json(err.message, 400);
                                    }
                                    else {
                                        res.json(err.message, err.code);
                                    }
                                }
                                else {
                                    // mongoose errors usually
                                    if (err.errors)
                                        self.bad_request(res, err.errors);
									else
										self.internal_error(err, req, res);
                                }

                                return;
                            }
                            // dehydrate resopnse object
                            response_obj = self.full_dehydrate(req,response_obj);
                            var status;
                            switch (method) {
                                case 'get':
                                    status = 200;
                                    break;
                                case 'post':
                                    status = 201;
                                    break;
                                case 'put':
                                    status = 201;
                                    break;
                                case 'delete':
                                    status = 204;
                                    break;
                            }
                            // send response
                            self.deserialize(req, res, response_obj, status);
                        });
                    });

                });

            }

        });
    },
    escape_regex:function(str) {
        return (str+'').replace(/([.*?+^$[\]\\(){}|-])/g, "\\$1");
    },

    /**
     * builds filtering objects from query string params
     *
     * @param query
     */
    build_filters:function (query) {
        var filters = {};
        var or_filter = [], nor_filter = [];
        for (var field in query) {

            // check for querying operators
            var parts = field.split('__');
            var field_name = parts[0];
            var operand = parts.length > 1 ? parts[1] : 'exact';
            if (field_name in this.filtering)
            {
                if(this.filtering[field_name] && typeof(this.filtering[field_name]) == 'object')
                {
                    if(operand in this.filtering[field_name])
                        filters[field] = query[field];
                    else {
                        if(this.strict)
                            return 'filter ' + field_name + ' with operand ' + operand + ' is not allowed. see allowed filters in schema';
                        else
                            continue;                    }
                }
                else
                    filters[field] = query[field];
            }
            else
            {
                if(field != 'or' && field != 'nor' && field != 'limit' && field != 'offset' && field != 'order_by')
                {
                    if(this.strict)
                        return 'filter ' + field_name + ' is not allowed. see allowed filters in schema';
                    else
                        continue;
                }
            }
            // support 'in' query
            if (operand == 'in')
                filters[field] = query[field].split(',');
            if(operand == 'near')
            {
                try{
                    var json = JSON.parse(query[field]);
                    if(json && json.lat && json.lng)
                        filters[field] = {lng:Number(json.lng), lat:Number(json.lat)};
                    else
                        return 'near filter only accepts two params: lat,lng as a list (i.e [23.32,43.231] ) or an object (i.e {"lat":23.32,"lng":43})';
                }
                catch (e) {
                    filters[field] = query[field].split(',');
                    if(filters[field].length != 2)
                        return 'near filter only accepts two params: lat,lng as a list (i.e [23.32,43.231] ) or an object (i.e {"lat":23.32,"lng":43})';
                    filters[field] = {lng:Number(filters[field][1]), lat:Number(filters[field][0])};
                }

            }
            // support regex operators
            if(operand == 'contains') {
                filters[field.replace('__contains','')] = new RegExp(this.escape_regex(filters[field]));
                delete filters[field];
            }
            if(operand == 'startswith') {
                filters[field.replace('__startswith','')] = new RegExp('^' + this.escape_regex(filters[field]));
                delete filters[field];
            }
            if(operand == 'endswith') {
                filters[field.replace('__endswith','')] = new RegExp(this.escape_regex(filters[field] + '$'));
                delete filters[field];
            }
            if(operand == 'iexact') {
                filters[field.replace('__iexact','')] = new RegExp('^' + this.escape_regex(filters[field]) + '$','i');
                delete filters[field];
            }
            if(operand == 'icontains') {
                filters[field.replace('__icontains','')] = new RegExp(this.escape_regex(filters[field]),'i');
                delete filters[field];
            }
            if(operand == 'istartswith') {
                filters[field.replace('__istartswith','')] = new RegExp('^' + this.escape_regex(filters[field]),'i');
                delete filters[field];
            }
            if(operand == 'iendswith') {
                filters[field.replace('__iendswith','')] = new RegExp(this.escape_regex(filters[field] + '$'),'i');
                delete filters[field];
            }
            if (field == 'or')
                or_filter = query[field].split(',');
            if (field == 'nor')
                nor_filter = query[field].split(',');
        }
        if (or_filter.length) {
            filters['or'] = [];
            for (var i = 0; i < or_filter.length; i++) {
                if (or_filter[i] in filters) {
                    var qry = {};
                    qry[or_filter[i]] = filters[or_filter[i]];
                    filters['or'].push(qry);
                    delete filters[or_filter[i]];
                }
            }
        }
        if (nor_filter.length) {
            filters['nor'] = [];
            for (var i = 0; i < nor_filter.length; i++) {
                if (nor_filter[i] in filters) {
                    var qry = {};
                    qry[nor_filter[i]] = filters[nor_filter[i]];
                    filters['nor'].push(qry);
                    delete filters[nor_filter[i]];
                }
            }
        }
        return filters;
    },

    /**
     * builds the sorting objects from query string params
     *
     * @param query
     */
    build_sorts:function (query) {
        var sorting = query['order_by'];
        if (sorting) {
            sorting = sorting.split(',');
            var sorts = [];
            for (var i = 0; i < sorting.length; i++) {
                var asec = sorting[i][0] != '-';
                if (sorting[i][0] == '-')
                    sorting[i] = sorting[i].substr(1);
                if(!this.sorting || sorting[i] in this.sorting)
                    sorts.push({field:sorting[i], type:asec ? 1 : -1});
            }
            return sorts;
        }
        return [];
    },

    /**
     * build cache key from query params
     *
     * @param id_query
     */
    build_cache_key:function (id_query) {
        var key = id_query;
        if (typeof(id_query) == 'object') {
            key = '';
            for (var field in id_query)
                key += field + '=' + id_query[field];

        }
        key = this.path + key;
        return key;
    },

    /**
     * get object with cache wrapping
     *
     * @param req
     * @param id
     * @param callback
     */
    cached_get_object:function (req, id, callback) {
        var self = this;
        // get from cache
        var cache_key = self.build_cache_key(id);
        self.cache.get(cache_key, function (err, object) {
            if (err) {
                callback(err);
                return;
            }
            // if returned from cache return it
            if (object) callback(null, object);
            else
                self.get_object(req, id, function (err, object) {
                    if (err) callback(err);
                    else {
                        self.cache.set(cache_key, object, function () {
                        });
                        callback(null, object);
                    }
                });
        });
    },

    /**
     * parses request body + makes sure only allowed field are passed on (from this.update_fields/this.update_tree)
     *
      * @param object
     * @param tree
     */
    hydrate:function (object, tree,exclude_tree) {
        if (Array.isArray(object)) {
            var objects = [];
            for (var i = 0; i < object.length; i++) {
                objects.push(this.hydrate(object[i], tree,exclude_tree));
            }
            return objects;
        }
        if (typeof(object) != 'object')
            return object;
//        if (!tree)
//            return object;
        var new_object = {};
		var tree_empty = tree ? true : false;
		var exclude_tree_empty = exclude_tree ? true : false;
        tree = tree || {};
        exclude_tree = exclude_tree || {};
        for (var field in object)
        {
            if(!tree_empty || field in tree)
            {
                if(!exclude_tree_empty || !(field in exclude_tree))
                    new_object[field] = this.hydrate(object[field], tree[field],exclude_tree[field]);
            }
        }
        return new_object;
    },

    show_fields:function(){
        return this.fields || [];
    },

    show_update_fields:function() {
        return this.update_fields || this.show_fields();
    },


    // Methods to implemenet

    /**
     * single object getter. (called on - show,update,delete)
     *
     * @param req
     * @param id
     * @param callback
     */
    get_object:function (req, id, callback) {
        throw new NotImplemented();
    },

    /**
     * multiple object getter. called on  - index
     *
     * @param req
     * @param filters
     * @param sorts
     * @param limit
     * @param offset
     * @param callback
     */
    get_objects:function (req, filters, sorts, limit, offset, callback) {
        throw new NotImplemented();
    },

    /**
     * save new object with fields. called on - create
     *
     * @param req
     * @param fields
     * @param callback
     */
    create_obj:function (req, fields, callback) {
        throw new NotImplemented();
    },

    /**
     * save existing object. called on - update
     *
     * @param req
     * @param object
     * @param callback
     */
    update_obj:function (req, object, callback) {
        throw new NotImplemented();
    },

    /**
     * delete object. called on - delete
     *
     * @param req
     * @param object
     * @param callback
     */
    delete_obj:function (req, object, callback) {
        throw new NotImplemented();
    }

});







