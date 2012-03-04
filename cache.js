var Class = require('class');

var Cache = module.exports = Class.extend({
    init:function () {
    },
    get:function (key, callback) {
        console.log("getting from cache %s", key);
        callback(null, null)
    },
    set:function (key, value, callback) {
        console.log("storing in cache %s", key);
        callback(null)
    }
});


