/**
 * Created by JetBrains WebStorm.
 * User: Ishai
 * Date: 14/02/12
 * Time: 18:53
 * To change this template use File | Settings | File Templates.
 */

var Throttling = exports.Throttling = function() { };

Throttling.prototype.throttle = function(identifier,callback)
{
    callback(null,false);
};
