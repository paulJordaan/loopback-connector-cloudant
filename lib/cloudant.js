var cloudant = require('cloudant');
var util = require('util');
var Connector = require('loopback-connector').Connector;
var debug = require('debug')('loopback:connector:cloudant');
var _ = require('lodash')._;

var helpers;

/**
 * Initialize the Cloudant connector for the given data source
 * @param {DataSource} dataSource The data source instance
 * @param {Function} [callback] The callback function
 */
exports.initialize = function initializeDataSource(dataSource, callback) {
  if (!cloudant) {
    return;
  }

  var s = dataSource.settings;

  dataSource.connector = new Cloudant(s, dataSource);

  if (callback) {
    dataSource.connector.connect(callback);
  }
};

/**
 * The constructor for Cloudant connector
 * @param {Object} settings The settings object
 * @param {DataSource} dataSource The data source instance
 * @constructor
 */
function Cloudant(settings, dataSource) {

	Connector.call(this, 'cloudant', settings);

  this.debug = settings.debug || debug.enabled;

  if (this.debug) {
    debug('Settings: %j', settings);
  }

  this.dataSource = dataSource;

  settings.hostname = settings.hostname || settings.host || '127.0.0.1';
  settings.protocol = settings.protocol || 'http';
  settings.port = settings.port || 5984;
  settings.database = settings.database || settings.db;

  if (!settings.database) {
    throw new Error("Database name must be specified in dataSource for Cloudant connector");
  }
  this.settings = settings;
  

  //Test
  this.connect(function(er, db){

  });

}

util.inherits(Cloudant, Connector);

/**
 * Connect to Cloudant
 * @param {Function} [callback] The callback function
 *
 * @callback callback
 * @param {Error} err The error object
 * @param {Db} db The mongo DB object
 */
Cloudant.prototype.connect = function (callback) {
  var self = this;
  var design;
  if (self.db) {
    process.nextTick(function () {
      callback && callback(null, self.db);
    });
  } else {
    var authUrl = this.buildAuthUrl();
  	cloudant(authUrl, function(err, cloudantDB) {
	  if (!err) {
       if (self.debug) {
         debug('Cloudant connection is established: ' + self.settings.hostname);
       }
       self.db = cloudantDB.db.use(self.settings.database);

       design = {
         views: {
           by_model: {
             map: 'function (doc) { if (doc.loopbackModel) return emit(doc.loopbackModel, null); }'
           }
         }
       };

       helpers.updateDesign(self.db, '_design/loopback', design);

       var index = {
        name: 'all_fields', type: 'text', index:{}
       };
       // // TESTING
       helpers.createIndex(self.db, index);

	  } else {
       if (self.debug || !callback) {
         console.error('Cloudant connection is failed: ' + self.settings.hostname, err);
       }
    }
    callback && callback(err, self.db);
	});
  }
};


Cloudant.prototype.relational = false;

Cloudant.prototype.getDefaultIdType = function() {
  return String;
};

Cloudant.prototype.getTypes = function() {
  return ['db', 'nosql', 'cloudant'];
};

Cloudant.prototype.getMetadata = function() {
  if (!this._metaData) {
    this._metaData = {
      types: this.getTypes(),
      defaultIdType: this.getDefaultIdType(),
      isRelational: this.isRelational,
      schemaForSettings: {}
    };
  }
  return this._metaData;
};

Cloudant.prototype.define = function(descr) {
  var self = this;
  var design, designName, hasIndexes, modelName, propName, value, viewName, _ref;
  modelName = descr.model.modelName;
  this._models[modelName] = descr;
  descr.properties._rev = {
    type: String
  };
  // design = {
  //   views: {}
  // };
  // hasIndexes = false;
  // _ref = descr.properties;
  // for (propName in _ref) {
  //   value = _ref[propName];
  //   if (value.index) {
  //     hasIndexes = true;
  //     viewName = helpers.viewName(propName);
  //     design.views[viewName] = {
  //       map: 'function (doc) { if (doc.loopbackModel === \'' + modelName + '\' && doc.' + propName + ') return emit(doc.' + propName + ', null); }'
  //     };
  //   }
  // }
  // if (hasIndexes) {
  //   designName = '_design/' + helpers.designName(modelName);
  //   return helpers.updateDesign(self.db, designName, design);
  // }
};

/**
 * Create a new model instance for the given data
 * @param {String} model The model name
 * @param {Object} data The model data
 * @param {Function} [callback] The callback function
 */
Cloudant.prototype.create = function(model, data, callback) {
  var self = this;
  if(self.debug) {
    debug('create', model, data);
  }
  return this.save(model, data, callback);
};

/**
 * Save the model instance for the given data
 * @param {String} model The model name
 * @param {Object} data The model data
 * @param {Function} [callback] The callback function
 */
Cloudant.prototype.save = function(model, data, callback) {
  var self = this;
  if(self.debug){
    debug('save', model, data);
  }
  if (!data) {
    return callback && callback("Cannot create an empty document in the database");
  }

  delete data._deleted;

  debug("Save Data", data);

  self.db.insert(self.toDatabase(model, data), function(err, body) {
      if (err) {
        return callback(err);
      }
      helpers.undoPrep(data);
      data._rev = body.rev;
      return callback && callback(null, body.id, body.rev);
  });
};

Cloudant.prototype.toDatabase = function(model, data) {
  var k, props, v;
  if (data == null) {
    data = {};
  }
  debug("beforeprep", data);
  helpers.savePrep(model, data);
  debug("afterprep", data);
  props = this._models[model].properties;
  for (k in props) {
    v = props[k];
    if (data[k] && props[k].type.name === 'Date' && (data[k].getTime != null)) {
      data[k] = data[k].getTime();
    }
  }
  debug("toDatabase:", data);
  return data;
};

Cloudant.prototype.fromDatabase = function(model, data) {
  var date, k, props, v;
  if (!data) {
    return data;
  }
  helpers.undoPrep(data);
  props = this._models[model].properties;
  for (k in props) {
    v = props[k];
    if ((data[k] != null) && props[k].type.name === 'Date') {
      date = new Date(data[k]);
      date.setTime(data[k]);
      data[k] = date;
    }
  }
  return data;
};

/**
 * Execute a Cloudant command
 * @param {String} model The model name
 * @param {String} command The command name
 * @param [...] params Parameters for the given command
 */
// Cloudant.prototype.execute = function(model, command) {
//   // var collection = this.collection(model);
//   // Get the parameters for the given command
//   var args = [].slice.call(arguments, 2);
//   // The last argument must be a callback function
//   var callback = args[args.length - 1];
//   var context = {
//     model: model,
//     // collection: collection, 
//     req: {
//       command: command,
//       params: args
//     }
//   };
//   this.notifyObserversAround('execute', context, function(context, done) {
//     args[args.length - 1] = function(err, result) {
//       if (err) {
//         debug('Error: ', err);
//       } else {
//         context.res = result;
//         debug('Result: ', result);
//       }
//       done(err, result);
//     }
//     debug('CouchDB: model=%s command=%s', model, command, args);
//     return collection[command].apply(collection, args);
//   }, callback);
// };

/**
 * Check if a model instance exists by id
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} [callback] The callback function
 *
 */
Cloudant.prototype.exists = function(model, id, callback) {
  var self = this;
  if(self.debug){
    debug('exists', model, id);
  }
  self.db.head(id, function(err, _, headers){
    if(err){
      return callback && callback(null,0);
    }
    return callback && callback(null,1);
  });
};

Cloudant.prototype.findById = function(id, callback) {
  console.log(" ---- FindByID ----");
  // var self = this;
  // if(self.debug){
  //   debug('findById', model, id);
  // }

  // self.db.get(id, function(err, body) {
  //   debug(err, body);
  //   if (err && err.statusCode === 404) {
  //     return callback && callback(null, []);
  //   }
  //   if (err) {
  //     return callback && callback(err);
  //   }
  //   return callback && callback(null, [self.fromDatabase(model, body)]);
  // });
};

/**
 * Find a model instance by id
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} [callback] The callback function
 */
Cloudant.prototype.find = function(model, id, callback) {
  var self = this;
  if(self.debug){
    debug('find', model, id);
  }
  var idName = self.idName(model);

};

/**
 * Update if the model instance exists with the same id or create a new instance
 *
 * @param {String} model The model name
 * @param {Object} data The model instance data
 * @param {Function} [callback] The callback function
 */
Cloudant.prototype.updateOrCreate = function(model, data, callback) {
  var self = this;
  if(self.debug) {
    debug('updateOrCreate', model, data);
  }
  delete data._deleted;

  var id = self.getIdValue(model, data);
  var idName = self.idName(model);
  delete data[idName];

  self.all(model,{where:{id:id}}, function(err, doc){
    helpers.merge(doc, data);
    doc = doc[0];
    // Doc does not exist
    if(doc == undefined){
      doc = data;
      doc._id = id;
    }

    self.save(model, doc, function(err, id, rev) {
      if (err) {
        return callback && callback(err);
      }
      doc.id = id;
      doc._rev = rev;

      var revNum = rev.split("-");
      var info
      if(revNum = '1'){
        info = { isNewInstance: true };
      }

      debug("updateOrCreate.callback", doc);

      return callback && callback(null, doc, info);
    });

  });

  // self.save(model, data, function(err, id, rev) {
  //   if (err) {
  //     return callback && callback(err);
  //   }
  //   data.id = id;
  //   data._rev = rev;

  //   var revNum = rev.split("-");
  //   var info
  //   if(revNum = '1'){
  //     info = { isNewInstance: true };
  //   }

  //   debug("updateOrCreate.callback", data);

  //   return callback && callback(null, data, info);
  // });

};

Cloudant.prototype.getLatestRevision = function(model, id, callback) {
  var self = this;
  self.db.head(id, function(err, _, headers) {
    var rev;
    if(err) {
      return callback && callback(err);
    }
    rev = headers.etag.substr(1, headers.etag.length - 2);
    return callback && callback(null, rev);
  });
};

/**
 * Delete a model instance by id
 * @param {String} model The model name
 * @param {*} id The id value
 * @param [callback] The callback function
 */
Cloudant.prototype.destroy = function(model, id, callback) {
  var self = this;
  if(self.debug) {
    debug('delete', model, id);
  }
  // id = self.coerseId(model, id);
  self.getLatestRevision(model, id, function(err, rev){
    if(err) {
      return callback && callback(err);
    }
    self.db.destroy(id, rev, function(err, body){
      return callback && callback(err, body);
    })
  });
};

// Cloudant.prototype.coerceId = function(model, id) {
//  if (id == null) return id;
//   var self = this;
//   var idValue = id;
//   var idName = self.idName(model);

//   // Type conversion for id
//   // var idProp = self.getPropertyDefinition(model, idName);
//   // if (idProp && typeof idProp.type === 'function') {
//   //   if (!(idValue instanceof idProp.type)) {
//   //     idValue = idProp.type(id);
//   //     if (idProp.type === Number && isNaN(id)) {
//   //       // Reset to id
//   //       idValue = id;
//   //     }
//   //   }
//   //   if (typeof idValue === 'string') {
//   //     idValue = ;
//   //   }
//   // }
//   if(typeof id != 'string'){
//     idValue = idValue.toString();
//   }

//   return idValue;
// };

/*!
 * Decide if id should be included
 * @param {Object} fields
 * @returns {Boolean}
 * @private
 */
function idIncluded(fields, idName) {
  if (!fields) {
    return true;
  }
  if (Array.isArray(fields)) {
    return fields.indexOf(idName) >= 0;
  }
  if (fields[idName]) {
    // Included
    return true;
  }
  if ((idName in fields) && !fields[idName]) {
    // Excluded
    return false;
  }
  for (var f in fields) {
    return !fields[f]; // If the fields has exclusion
  }
  return true;
}

Cloudant.prototype.buildWhere = function(model, where) {
  var self = this;
  var query = {};
  if (where === null || (typeof where !== 'object')) {
    return query;
  }
  var idName = self.idName(model);
  Object.keys(where).forEach(function (k) {
    var cond = where[k];
    if (k === 'and' || k === 'or' || k === 'nor') {
      if (Array.isArray(cond)) {
        cond = cond.map(function(c) {
          return self.buildWhere(model, c);
        });
      }
      query['$' + k] = cond;
      delete query[k];
      return;
    }
    if (k === idName) {
      k = '_id';
    }
    var propName = k;
    if (k === '_id') {
      propName = idName;
    }
    var prop = self.getPropertyDefinition(model, propName);

    var spec = false;
    var options = null;
    if (cond && cond.constructor.name === 'Object') {
      options = cond.options;
      spec = Object.keys(cond)[0];
      cond = cond[spec];
    }
    if(cond && cond.constructor.name === 'Date'){
      cond = cond.getTime();
    }
    if (spec) {
      if (spec === 'between') {
        query[k] = { $gte: cond[0], $lte: cond[1]};
      } else if (spec === 'inq') {
        if(cond.length){
          query[k] = {
            $in: cond.map(function(x) {
              // if ('string' !== typeof x) return x;
              // // return ObjectID(x);
              return x;
            })
          };
        } else {
          // Hack: If the inq array is empty the field should not exist
          query[k] = {$exists: false};
        }
      } else if (spec === 'nin') {
        query[k] = {
          $nin: cond.map(function(x) {
            // if ('string' !== typeof x || prop.type !== ObjectID) return x;
            // return ObjectID(x);
            return x;
          })
        };
      } else if (spec === 'like') {
        query[k] = {$regex: new RegExp(cond, options)};
      } else if (spec === 'nlike') {
        query[k] = {$not: new RegExp(cond, options)};
      } else if (spec === 'neq') {
        query[k] = {$ne: cond};
      } else if (spec === 'regexp') {
        if (cond.global)
          console.warn('MongoDB regex syntax does not respect the `g` flag');

        query[k] = {$regex: cond};
      }
      else {
        query[k] = {};
        query[k]['$' + spec] = cond;
      }
      // end spec
    } else {
      if (cond === null) {
        // http://docs.mongodb.org/manual/reference/operator/query/type/
        // Null: 10
        query[k] = {$type: 10};
      } else {
        query[k] = cond;
      }
    }
  });
  return query;
};

/**
 * Find matching model instances by the filter
 *
 * @param {String} model The model name
 * @param {Object} filter The filter
 * @param {Function} [callback] The callback function
 */
Cloudant.prototype.all = function(model, filter, callback) {
  // TODO 
  // Use index with sort, limit,skip if index is available
  // Otherwise get all documents and use build in sort, limit, skip
  var self = this;
  if(self.debug){
    debug('all', model, filter);
  }
  filter = filter || {};
  var idName = self.idName(model);
  var query = {};
  if(filter.where) {
    if(filter.where[idName]) {
      var id = filter.where[idName];
      delete filter.where[idName];
      if(id.constructor !== Object) {
        // console.log("coerseId");
        // console.log(id);
        // id = self.coerseId(model, id);
      }
      filter.where._id = id;
    }
    query = self.buildWhere(model, filter.where);
  }

  // Data operations
  var order = {};
  if(!filter.order) {
    var idNames = self.idNames(model);
    if(idNames && idNames.length) {
      filter.order = idNames;
    }
  }
  if(filter.order) {
    var keys = filter.order;
    if (typeof keys === 'string') {
      keys = keys.split(',');
    }
    for (var index = 0, len = keys.length; index < len; index++) {
      var m = keys[index].match(/\s+(A|DE)SC$/);
      var key = keys[index];
      key = key.replace(/\s+(A|DE)SC$/, '').trim();
      if (key === idName) {
        key = '_id';
      }

      key = key + ":string";

      if (m && m[1] === 'DE') {
        order[key] = 'desc';
      } else {
        order[key] = 'asc';
      }
    }
  } else {
    order = {'_id:string': 'desc'};
  }

  var limit = 200;
  if(filter.limit) {
    limit = filter.limit;
  }

  var skip = 0;
  if(filter.skip) {
    skip = filter.skip;
  } else if(filter.offset) {
    skip = filter.offset;
  }

  var fields = [];
  if(filter.fields) {
    fields = filter.fields;
  }

    // TODO - implement sort
  if(!_.isArray(order)) {
    order = [order];
  }
  query["loopbackModel"] = model;

  debug("Query: ", query);

  // debug('fields', fields);
  // debug('sort', order);
  // debug('limit', limit);
  // debug('skip', skip);

  self.db.find({
    selector: query, 
    fields: fields,
    sort: order,
    limit: limit,
    skip: skip
  }, processResponse);

  var docs = [];
  function processResponse(err, result) {
    if(err) {
      return callback(err);
    }
    debug("RESULT: ", result);
    // var docs = [];
    if(docs.length == 0){

      docs = result.docs ;
    } else {
      docs = docs.concat(result.docs);
    }

    if(result.bookmark && result.docs.length >= 200){
        self.db.find({
          selector: query, 
          fields: fields,
          sort: order,
          limit: limit,
          skip: skip,
          bookmark: result.bookmark
        }, processResponse);
    } else {
      if(self.debug) {
        debug('all', model, filter, err, docs);
      }

      // var objs = docs.map(function(o) {
      //   if(idIncluded(fields, self.idNames(model))) {
      //     self.setIdValue(model, o, o._id);
      //   }
      //   // Don't pass back _id if the fields is set
      //   if (fields || idName !== '_id') {
      //     delete o._id;
      //   }
      //   console.log(o);

      //   o = self.fromDatabase(model, o);
      //   return o;
      // });
      
      var results = [];
      for(var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        // Don't pass back _id if the fields is set
        // if (fields || idName !== '_id') {
        //   delete doc._id;
        // }
        results.push(self.fromDatabase(model, doc));
      }
      
      if(self.debug) {
        debug('all fromDatabase',results);
      }

      if (filter && filter.include) {
        self._models[model].model.include(results, filter.include, callback);
      } else {
        return callback(null, results);
      }
    }
  }

};

/**
 * Delete all instances for the given model
 * @param {String} model The model name
 * @param {Object} [where] The filter for where
 * @param {Function} [callback] The callback function
 */
Cloudant.prototype.destroyAll = function(model, where, callback) {
  var self = this;
  if(self.debug) {
    debug('destroyAll', model, where);
  }
  if(!callback && 'function' == typeof where) {
    callback = where;
    where = undefined;
  }
  self.all(model, {where: where}, function(err, docs){
    if(err) {
      return callback && callback(err);
    }
    if(debug) {
      debug('destroyAll.docs', docs);
    }
    var i, results, doc;
    results = [];
    for(i = 0; i < docs.length; i++) {
      doc = docs[i];
      results.push({
        _id: doc.id,
        _rev: doc._rev,
        _deleted: true
      });
    }
    self.db.bulk({docs: results}, function(err, body) {
      return callback && callback(err, {count: results.length});
    });
  });
};

/**
 * Count the number of instances for the given model
 *
 * @param {String} model The model name
 * @param {Function} [callback] The callback function
 * @param {Object} filter The filter for where
 *
 */
Cloudant.prototype.count = function(model, where, options, callback) {
  var self = this;
  if(self.debug) {
    debug('count', model, where);
  }
  this.all(model, {where: where}, function(err, docs) {
    if(err) {
      return callback && callback(err);
    }
    if (self.debug) {
      debug('count.callback', model, err, docs.length);
    }
    return callback && callback(null, docs.length);
  });
};

/**
 * Update all matching instances
 * @param {String} model The model name
 * @param {Object} where The search criteria
 * @param {Object} data The property/value pairs to be updated
 * @callback {Function} cb Callback function
 */
Cloudant.prototype.update =
  Cloudant.prototype.updateAll = function updateAll(model, where, data, callback) {
    var self = this;
    if(self.debug) {
      debug('updateAll', model, where, data);
    }
    var idName = this.idName(model);

    self.all(model, {where: where}, function(err, docsFromDb) {
      var doc, docs;
      if(err) {
        return callback && callback(err);
      }
      helpers.merge(docsFromDb, data);
      if(!_.isArray(docsFromDb)) {
        docsFromDb = [docsFromDb];
      }

      var results = [];
      for(var i = 0; i < docsFromDb.length; i ++) {
        var doc = docsFromDb[i];
        results.push(self.toDatabase(model,doc));
      }

      self.db.bulk({docs: results}, function(err, body) {
        if(err) {
          return callback && callback(err);
        }
        if(self.debug) {
          debug('updateAll.callback', model, where, data, err, body);
        }

        var affectedCount = body.length;

        return callback && callback(err, {count: affectedCount});

      });

    });
  };

/**
 * Update properties for the model instance data
 * @param {String} model The model name
 * @param {Object} data The model data
 * @param {Function} [callback] The callback function
 */
Cloudant.prototype.updateAttributes = function(model, id ,data, callback) {
  var self = this;

  delete data._deleted;
  self.db.get(id, function(err, doc) {
    if (err) {
      return callback && callback(err);
    }

    self.save(model, helpers.merge(doc, data), function(err, rsp) {
      if (err) {
        return callback && callback(err);
      }
      doc._rev = rsp.rev;
      return callback && callback(null, doc);
    });

  });
};



Cloudant.prototype.ping = function(cb){
    var authUrl = this.buildAuthUrl();
    // console.log(authUrl);
    cloudant(authUrl, function(err, cloudantDB) {
      if(!err) cb();
      else cb(err);
    });
};

Cloudant.prototype.buildAuthUrl = function() {
  var authString, url;
  if (this.settings && (this.settings.username || this.settings.user) && (this.settings.password || this.settings.pass)) {
    authString = (this.settings.username || this.settings.user) + ':' + (this.settings.password || this.settings.pass) + '@';
  } else {
    authString = '';
  }
  url = this.settings.protocol + '://' + authString + this.settings.hostname;
  return url;
};

helpers = {
  invokeCallbackOrLogError: function(callback, err, res) {
    if (callback) {
      return callback && callback(err, res);
    } else if (err) {
      return console.log(err);
    }
  },
  merge: function(base, update) {
    if (!base) {
      return update;
    }
    if (!_.isArray(base)) {
      _.extend(base, update);
    } else {
      _.each(base, function(doc) {
        return _.extend(doc, update);
      });
    }
    return base;
  },
  undoPrep: function(data) {
    var _id;
    if (_id = data._id) {
      data.id = _id.toString();
    }
    delete data._id;
    delete data.loopbackModel;
  },
  savePrep: function(model, data) {
    var id;
    if (id = data.id) {
      data._id = id.toString();
    }
    delete data.id;
    if (data._rev === null) {
      delete data._rev;
    }
    if (model) {
      data.loopbackModel = model;
    }
  },
  designName: function(modelName) {
    return 'loopback_' + modelName;
  },
  viewName: function(propName) {
    return 'by_' + propName;
  },
  updateDesign: function(db, designName, design, callback) {
    db.get(designName, function(err, designDoc) {
      if (err && err.error !== 'not_found') {
        return helpers.invokeCallbackOrLogError(callback, err, designDoc);
      }
      if (!designDoc) {
        designDoc = design;
      } else {
        if (_.isEqual(designDoc.views, design.views)) {
          return helpers.invokeCallbackOrLogError(callback, null, designDoc);
        }
        designDoc.views = design.views;
      }
      return db.insert(designDoc, designName, function(err, insertedDoc) {
        return helpers.invokeCallbackOrLogError(callback, err, insertedDoc);
      });
    });
  },
  createIndex: function(db, index, callback) {
    db.index(index, function(err, result) {
      return helpers.invokeCallbackOrLogError(callback, err, result);
    });
  }
}
