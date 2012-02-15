/**
 * Created by JetBrains WebStorm.
 * User: Ishai
 * Date: 14/02/12
 * Time: 18:43
 * To change this template use File | Settings | File Templates.
 */

var util = require('util');

var Validation = exports.Validation = function() {};

Validation.prototype.is_valid = function(json,callback)
{
    callback(null,{});
};

var MongooseValidation = exports.MongooseValidation = function(model)
{
    MongooseValidation.super_.call(this);
    this.model = model;
};

util.inherits(MongooseValidation,Validation);
exports.MongooseValidation = MongooseValidation;

MongooseValidation.prototype.elaborate_default_errors = function(field,error)
{
    // check if mongoose error
    if(error in field.options)
    {
        switch(error)
        {
            case 'required':
                return 'this field is required';
            case 'min':
                return 'must be equal or greater than ' + field.options.min;
            case 'max':
                return 'must be equal or lower than ' + field.options.max;
            case 'enum':
        }       return 'must be one of the following ' + field.options.enum;
    }
    return error;
};

MongooseValidation.prototype.is_valid = function(object,callback)
{
    var errors = {};
    var fields = this.model.schema.paths;
    for(var field_name in fields)
    {
        var field = fields[field_name];
        var field_validators = field.validators;
        var type = field.options.type;
        var field_errors = [];
        var default_value = field.defaultValue;
        var parts = field.split('.');
        var value = object;
        var skip = false;
        for(var i=0; i<parts.length; i++)
        {
            if(value == null || typeof(value) == 'undefined')
            {
                skip = true;
                break;
            }
            value = value[parts[i]];
        }
        if(skip)
            continue;
        if(typeof(value) == 'undefined' || value == null)
            value = default_value;
        for(var i=0; i<field_validators.length; i++)
        {
            if(!field_validators[i][0](value))
                field_errors.push(this.elaborate_default_errors(field,field_validators[i][1]))
        }
        if(field_errors.length)
            errors[field_name] = field_errors;
    }
    callback(null,errors);
};

