/**
 * Created by JetBrains WebStorm.
 * User: Ishai
 * Date: 14/02/12
 * Time: 18:48
 * To change this template use File | Settings | File Templates.
 */

var Authentication = exports.Authentication = function() {};

// does the request is authenticated, callback false will return 401
Authentication.prototype.is_authenticated = function(req,callback) { callback(null,true); }

// get a request identifier, uses for throtelling (optional)
Authentication.prototype.get_request_identifier = function(req) { return req.connection.remoteAddress; }

