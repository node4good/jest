var util = require('util');

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

var Resource = function()
{

};

var NotImplemented = function()
{

};

Resource.prototype.get_objects = function(req,callback)
{
    throw NotImplemented();
}

Resource.prototype.index = function(req,res)
{
    this.get_objects(req,function(err,objects)
    {
       res.json(objects,200);
    });
};

var MongooseResource = function(model)
{
    MongooseResource.super_.call(this);
    this.model = model;
}

util.inherits(MongooseResource,Resource);

MongooseResource.prototype.get_objects = function(req,callback)
{
    this.model.find(req.query,callback);
}



exports.Resource = Resource;

exports.MongooseResource = MongooseResource;
