var express = require('express')
  , Resource = require('express-resource')
  , app = express.createServer();

var rest_api = require('./api');
var TestResource = require('./resources').TestResource;

app.resource('tests', rest_api.register_resource(new TestResource()));

app.listen(80);