var Class = require('class');

var Throttling = module.exports = Class.extend({
    init:function () {
    },
    throttle:function (identifier, callback) {
        callback(null, false);
    }
});