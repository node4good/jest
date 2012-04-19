var _ = require('underscore'),
    Class = require('sji'),
    Resource = require('express-resource');

var Api = module.exports = Class.extend({
    init:function (path, app) {
        this.path = /^(\/+)?$/g.test(path)
            ?
            '/'
            :
            _.chain([])
                .push(
                    path.replace(
                        /^(\/)?(.+[^\/])?(\/)?$/,
                        '$2'
                        )
                )
                .push('/')
                .join('')
                .value();

        this.app = app;
        //Default Settings For Api
        this.settings = {
            DEFAULT_LIMIT:20,
            MAX_LIMIT:500
        };
        //Copy From App Settings (api) Defaults
        _.extend(this.settings, this.app.settings.api);

        this.resources = [];
        this.resources_schemas = [];

        var self = this;
        this.app.get('/' + this.path, function(req, res){
            res.json(self.resources);
        });
    },
    /**
     * Register Resource to the Api
     * @param name
     * @param resource
     */
    register:function (name, resource) {
        //Get Default Settings For Api to Resource
        resource.settings = this.settings;

        resource.path = _.chain([])
            .push(this.path)
            .push(name)
            .join('')
            .value();

        resource.schema_path = _.chain([])
            .push(this.path)
            .push('schema/')
            .push(name)
            .join('')
            .value();

        this.resources.push({
            name:name,
            url:resource.path,
            schema: resource.schema_path
        });

        this.resources_schemas.push({
            name:name,
            url:resource.path,
            allowed_methods:resource.allowed_methods,
            fields:resource.show_fields(),
            update_fields:resource.show_update_fields(),
            filtering : _.map(resource.filtering || {},function(value,key)
            {
                return { field : key, usage1: resource.path + '?' + key + '=<value>', usage2: resource.path + '?' + key + '__in=<value1>,<value2>'};
            }),
            sorting : resource.path + "?order_by=<field1>,<field2>"
        });

        var resource_index = this.resources.length -1;

        var self = this;
        this.app.get('/' + resource.schema_path,function(req,res){
            res.json(self.resources_schemas[resource_index]);
        });

        this.app.resource(resource.path, (function(methods){
            _.each(['show', 'index', 'create', 'update', 'destroy', 'load'], function(name) {
                methods[name] = function () {
                    return resource[name].apply(resource, arguments);
                };
            });
            return methods;
        })({}));

    },
    //Alias for register -Backword Compability
    register_resource:function () {
        this.register.apply(this, arguments);
    }
});

