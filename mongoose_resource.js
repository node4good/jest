var _ = require('underscore'),
    Class = require('sji'),
    Resource = require('./resource');
    Validation = require('./mongoose_validation');

var MongooseResource = module.exports = Resource.extend({
    init:function (model) {
        this._super();
        this.model = model;
        this.default_filters = {};
        this.default_query = function (query) {
            return query;
        };
        this.validation = new Validation(model);
    },

    show_fields : function(){
        return this.fields || _.map(this.model.schema.tree,function(value,key)
        {
            return key;
        });
    },

    get_object:function (req, id, callback) {
        var query = this.model.findById(id);
        this.authorization.limit_object(req, query, function (err, query) {
            if (err) callback(err);
            else {
                query.exec(callback);
            }
        });
    },

    get_objects:function (req, filters, sorts, limit, offset, callback) {
        var self = this;

        var query = this.default_query(this.model.find(this.default_filters));
        var count_query = this.default_query(this.model.count(this.default_filters));

        for (var filter in filters) {
            var splt = filter.split('__');
            var query_op = null;
            var query_key = filter;
            var query_value = filters[filter];
            if (splt.length > 1) {
                query_key = splt[0];
                query_op = splt[1];
            }
            if(self.model.schema.paths[query_key].options.type == Boolean)
                query_value = query_value.toLowerCase().trim() == 'true';
            if(self.model.schema.paths[query_key].options.type == Number)
                query_value = Number(query_value.trim());
            if(query_op)
            {
                query.where(query_key)[query_op](query_value);
                count_query.where(query_key)[query_op](query_value);
            }
            else
            {
                query.where(query_key, query_value);
                count_query.where(query_key, query_value);
            }
            console.log(typeof(query_value));
            console.log(query_value);
        }

        var default_sort = query.options.sort || [];
        query.options.sort = [];

        for (var i = 0; i < sorts.length; i++)
            query.sort(sorts[i].field, sorts[i].type);

        for(var i=0; i<default_sort.length; i++)
            query.options.sort.push(default_sort[i]);

        query.limit(limit);
        query.skip(offset);

        var results = null, count = null;

        function on_finish() {
            if (results != null && count != null) {
                var final = {
                    objects:results,
                    meta:{
                        total_count:count,
                        offset:offset,
                        limit:limit
                    }
                };
                callback(null, final);
            }
        }

        self.authorization.limit_object_list(req, query, function (err, query) {
            if (err) callback(err);
            else
                query.exec(function (err, objects) {
                    if (err) callback(err);
                    else {
                        results = objects;
                        on_finish();
                    }
                });
        });

        self.authorization.limit_object_list(req, count_query, function (err, count_query) {
            if (err) callback(err);
            else
                count_query.exec(function (err, counter) {
                    if (err) callback(err);
                    else {
                        count = counter;
                        on_finish();
                    }
                });
        });
    },

    create_obj:function (req, fields, callback) {
        var self = this;

        var object = new self.model();

        for (var field in fields) {
            object[field] = fields[field];
        }

        self.authorization.edit_object(req, object, function (err, object) {
            if (err) callback(err);
            else {
                object.save(function (err, object) {
                    callback(self.elaborate_mongoose_errors(err), object);
                });
            }
        });
    },

    update_obj:function (req, object, callback) {
        var self = this;

        self.authorization.edit_object(req, object, function (err, object) {
            if (err) callback(err);
            else {
                object.save(function (err, object) {
                    callback(self.elaborate_mongoose_errors(err), object);
                });
            }
        });
    },

    delete_obj:function (req, object, callback) {
        object.delete(function (err) {
            if (err) callback(err);
            else
                callback(null, {});
        });
    },

    elaborate_mongoose_errors:function (err) {
        if (err && err.errors) {
            for (var error in err.errors) {
                err.errors[error] = this.validation.elaborate_mongoose_error(error, err.errors[error]);
            }
        }
        return err;
    }
});

