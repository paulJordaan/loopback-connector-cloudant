module.exports = require('should');

var DataSource = require('loopback-datasource-juggler').DataSource;

var conf = {};

var config = require('rc')('loopback', conf);

global.config = config;

global.getDataSource = global.getSchema = function (customConfig) {
  var db = new DataSource(require('../'), customConfig || config);
  db.log = function (a) {
    console.log(a);
  };

  return db;
};

global.sinon = require('sinon');