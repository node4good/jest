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

        this.resources.push({name:name, url:resource.path});


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

