/**
 * Created by JetBrains WebStorm.
 * User: Ishai
 * Date: 10/02/12
 * Time: 16:50
 * To change this template use File | Settings | File Templates.
 */
var MongooseResource = require('./api.js').MongooseResource;
var Test = {
    find: function(params,callback)
    {
        callback(null,[{name:'fd'},{name:'fdg'}]);
    }
}

var TestResource = function()
{
      TestResource.super_.call(this,Test);
}

require('util').inherits(TestResource,MongooseResource);

exports.TestResource = TestResource;