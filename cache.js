/**
 * Created by JetBrains WebStorm.
 * User: Ishai
 * Date: 14/02/12
 * Time: 18:52
 * To change this template use File | Settings | File Templates.
 */



var Cache = exports.Cache = function() {};

Cache.prototype.get = function(key,callback) {
    console.log('getting from cache ' + key);
    callback(null,null)
};

Cache.prototype.set = function(key,value,callback) {
    console.log('storing in cache ' + key);
    callback(null)
};

