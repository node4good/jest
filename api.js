
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
}


var Api = function(path,app)
{
    this.path = path;
    if(this.path[this.path.length-1] != '/')
        this.path += '/';
    if(this.path[0] == '/')
        this.path = this.path.substr(1);
    this.app = app;
    this.resources = [];
    var self = this;
    app.get('/' + this.path,function(req,res)
    {
        res.json(self.resources);
    });
};

Api.prototype.register_resource = function(names,resource)
{
    this.resources.push({ 'name' : names,url:'/' + this.path + names + '/'});
    this.app.resource(this.path + names, resource_class_to_module(resource));
};

exports.Api = Api;




