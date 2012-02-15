// gets express-resource in order to user 'app.resource'
var Resource = require('express-resource');

var resource_class_to_module = function(resource)
{
	return {
		show : function(req,res) { return resource.show(req,res); },
		index : function(req,res) { return resource.index(req,res); },
		new : function(req,res) { return resource.new(req,res); },
		edit : function(req,res) { return resource.edit(req,res); },
		create : function(req,res) { return resource.create(req,res); },
		update : function(req,res) { return resource.update(req,res); },
		delete : function(req,res) { return resource.delete(req,res); },
        load: function(req,id,fn) { return resource.load(req,id,fn); }
	};
};


// API object
// path:  path to listen on i.e : 'api/'
// app:   express app
var Api = function(path,app)
{
    this.path = path;
    if(this.path[this.path.length-1] != '/')
        this.path += '/';
    if(this.path[0] == '/')
        this.path = this.path.substr(1);
    this.name = this.path.replace(',','');
    this.app = app;
    this.resources = [];
    var self = this;
    app.get('/' + this.path,function(req,res)
    {
        res.json(self.resources);
    });
};

// register resource to API
// names:       path in the api, i.e : 'users'
// resource:    resource to register in
Api.prototype.register_resource = function(names,resource)
{
    var url = '/' + this.path + names + '/';
    this.resources.push({ 'name' : names,url:url});
    this.app.resource(this.path + names, resource_class_to_module(resource));
    resource.api_name = this.name;
    resource.name = this.names.replace('/','');
    resource.uri = url;
};

exports.Api = Api;




