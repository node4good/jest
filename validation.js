var _ = require("underscore"),
    Class = require('class');

var Validation = module.exports = Class.extend({
    init:function () {
    },
    is_valid:function (json, callback) {
        callback(null, {});
    }
});