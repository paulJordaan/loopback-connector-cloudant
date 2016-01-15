var should = require('./init.js');


var Superhero, User, Post, PostWithStringId, db;

describe('cloudant connector', function () {
  this.timeout(100000);

  before(function () {
    db = getDataSource();

    User = db.define('User', {
      name: { type: String, index: true },
      email: { type: String, index: true, unique: true },
      age: {type: Number, index: true},
      icon: Buffer
    }, {
      indexes: {
        name_age_index: {
          keys: {name: 1, age: -1}
        }, // The value contains keys and optinally options
        age_index: {age: -1} // The value itself is for keys
      }
    });

    Superhero = db.define('Superhero', {
      name: { type: String, index: true },
      power: { type: String, index: true, unique: true },
      address: { type: String, required: false, index: { mongodb: { unique: false, sparse: true } } },
      description: { type: String, required: false },
      geometry: { type: Object, required: false, index: { mongodb: { kind: "2dsphere" } } },
      age: Number,
      icon: Buffer
    });

    Post = db.define('Post', {
      title: { type: String, length: 255, index: true },
      content: { type: String },
      comments: [String]
    });

    Product = db.define('Product', {
      name: { type: String, length: 255, index: true },
      description:{ type: String},
      price: { type: Number },
      pricehistory: { type: Object }
    });

    PostWithStringId = db.define('PostWithStringId', {
      id: {type: String, id: true},
      title: { type: String, length: 255, index: true },
      content: { type: String }
    });

    User.hasMany(Post);
    Post.belongsTo(User);
	
	});

  beforeEach(function (done) {
    User.destroyAll(function () {
      Post.destroyAll(function () {
        done();
      });
    });
  });

  // describe('.ping(cb)', function() {
  //   it('should return true for valid connection', function(done) {
  //     this.timeout(100000);
  //     db.ping(done);
  //   });
  // });
  
  // it('should invoke hooks', function(done) {
  //   var events = [];
  //   var connector = Post.getDataSource().connector;
  //   connector.observe('before execute', function(ctx, next) {
  //     ctx.req.command.should.be.string;
  //     ctx.req.params.should.be.array;
  //     events.push('before execute ' + ctx.req.command);
  //     next();
  //   });
  //   connector.observe('after execute', function(ctx, next) {
  //     ctx.res.should.be.object;
  //     events.push('after execute ' + ctx.req.command);
  //     next();
  //   });
  //   Post.create({title: 'Post1', content: 'Post1 content'}, function(err, p1) {
  //     Post.find(function(err, results) {
  //       events.should.eql(['before execute insert', 'after execute insert',
  //         'before execute find', 'after execute find']);
  //       connector.clearObservers('before execute');
  //       connector.clearObservers('after execute');
  //       done(err, results);
  //     });
  //   });
  // });
  //
  
  it('save should not return cloudant _id', function (done) {
    Post.create({title: 'Post1', content: 'Post content'}, function (err, post) {
      post.content = 'AAA';
      post.save(function(err, p) {
        should.not.exist(err)
        should.not.exist(p._id);
        p.id.should.be.equal(post.id);
        p.content.should.be.equal('AAA')

        done();
      });
    });
  });


  it('hasMany should support additional conditions', function (done) {
    User.create(function (e, u) {
      u.posts.create({}, function (e, p) {
        u.posts({where: {id: p.id}}, function (err, posts) {
          should.not.exist(err);
          posts.should.have.lengthOf(1);

          done();
        });
      });
    });
  });

    it('should allow to find by id using where', function (done) {
    Post.create({title: 'Post1', content: 'Post1 content'}, function (err, p1) {
      Post.create({title: 'Post2', content: 'Post2 content'}, function (err, p2) {
        Post.find({where: {id: p1.id}}, function (err, p) {
          should.not.exist(err);
          should.exist(p && p[0]);
          p.length.should.be.equal(1);
          // Not strict equal
          p[0].id.should.be.eql(p1.id);
          done();
        });
      });
    });
  });

  it('should allow to find by id using where inq', function (done) {
    Post.create({title: 'Post1', content: 'Post1 content'}, function (err, p1) {
      Post.create({title: 'Post2', content: 'Post2 content'}, function (err, p2) {
        Post.find({where: {id: {inq: [p1.id]}}}, function (err, p) {
          should.not.exist(err);
          should.exist(p && p[0]);
          p.length.should.be.equal(1);
          // Not strict equal
          p[0].id.should.be.eql(p1.id);
          done();
        });
      });
    });
  });


  describe('updateAll', function () {
    it('should update the instance matching criteria', function (done) {
      User.create({name: 'Al', age: 31, email:'al@strongloop'}, function (err1, createdusers1) {
        should.not.exist(err1);
        User.create({name: 'Simon', age: 32,  email:'simon@strongloop'}, function (err2, createdusers2) {
          should.not.exist(err2);
          User.create({name: 'Ray', age: 31,  email:'ray@strongloop'}, function (err3, createdusers3) {
            should.not.exist(err3);

            User.updateAll({age:31},{company:'strongloop.com'},function(err,updatedusers) {
              should.not.exist(err);
              updatedusers.should.have.property('count', 2);

              User.find({where:{age:31}},function(err2,foundusers) {
                should.not.exist(err2);
                foundusers[0].company.should.be.equal('strongloop.com');
                foundusers[1].company.should.be.equal('strongloop.com');

                done();
              });

            });
          });
        });
      });
    });

  });

  it('updateOrCreate should update the instance', function (done) {
    Post.create({title: 'a', content: 'AAA'}, function (err, post) {
      post.title = 'b';
      Post.updateOrCreate(post, function (err, p) {
        should.not.exist(err);
        p.id.should.be.equal(post.id);
        p.content.should.be.equal(post.content);
        should.not.exist(p._id);

        Post.findById(post.id, function (err, p) {
          p.id.should.be.eql(post.id);
          should.not.exist(p._id);
          p.content.should.be.equal(post.content);
          p.title.should.be.equal('b');

          done();
        });
      });

    });
  });

  it('updateOrCreate should update the instance without removing existing properties', function (done) {
      Post.create({title: 'a', content: 'AAA', comments: ['Comment1']}, function (err, post) {
        post = post.toObject();
        delete post.title;
        delete post.comments;
        Post.updateOrCreate(post, function (err, p) {
          should.not.exist(err);
          p.id.should.be.equal(post.id);
          p.content.should.be.equal(post.content);
          should.not.exist(p._id);

          Post.findById(post.id, function (err, p) {
            p.id.should.be.eql(post.id);
            should.not.exist(p._id);
            p.content.should.be.equal(post.content);
            p.title.should.be.equal('a');
            p.comments[0].should.be.equal('Comment1');

            done();
          });
        });

      });
    });

    it('updateOrCreate should create a new instance if it does not exist', function (done) {
      var post = {id: '123e', title: 'a', content: 'AAA'};
      Post.updateOrCreate(post, function (err, p) {
        should.not.exist(err);
        p.title.should.be.equal(post.title);
        p.content.should.be.equal(post.content);
        p.id.should.be.eql(post.id);
        Post.findById(p.id, function (err, p) {
          p.id.should.be.equal(post.id);
          should.not.exist(p._id);
          p.content.should.be.equal(post.content);
          p.title.should.be.equal(post.title);
          p.id.should.be.equal(post.id);

          done();
        });
      });

    });

    it('save should update the instance with the same id', function (done) {
      Post.create({title: 'a', content: 'AAA'}, function (err, post) {
        post.title = 'b';
        post.save(function (err, p) {
          should.not.exist(err);
          p.id.should.be.equal(post.id);
          p.content.should.be.equal(post.content);
          should.not.exist(p._id);
          Post.findById(post.id, function (err, p) {
            p.id.should.be.eql(post.id);
            should.not.exist(p._id);
            p.content.should.be.equal(post.content);
            p.title.should.be.equal('b');

            done();
          });
        });

      });
    });

    it('save should update the instance without removing existing properties', function (done) {
      Post.create({title: 'a', content: 'AAA'}, function (err, post) {
        delete post.title;
        post.save(function (err, p) {
          should.not.exist(err);
          p.id.should.be.equal(post.id);
          p.content.should.be.equal(post.content);
          should.not.exist(p._id);

          Post.findById(post.id, function (err, p) {
            p.id.should.be.eql(post.id);
            should.not.exist(p._id);
            p.content.should.be.equal(post.content);
            p.title.should.be.equal('a');

            done();
          });
        });

      });
    });

    it('save should create a new instance if it does not exist', function (done) {
      var post = new Post({id: '123e', title: 'a', content: 'AAA'});
      post.save(post, function (err, p) {
        should.not.exist(err);
        p.title.should.be.equal(post.title);
        p.content.should.be.equal(post.content);
        p.id.should.be.equal(post.id);

        Post.findById(p.id, function (err, p) {
          p.id.should.be.equal(post.id);
          should.not.exist(p._id);
          p.content.should.be.equal(post.content);
          p.title.should.be.equal(post.title);
          p.id.should.be.equal(post.id);

          done();
        });
      });

    });

    it('all return should honor filter.fields', function (done) {
    var post = new Post({title: 'b', content: 'BBB'})
    post.save(function (err, post) {
      Post.all({fields: ['title'], where: {title: 'b'}}, function (err, posts) {
        should.not.exist(err);
        posts.should.have.lengthOf(1);
        post = posts[0];
        post.should.have.property('title', 'b');
        post.should.have.property('content', undefined);
        should.not.exist(post._id);
        should.not.exist(post.id);

        done();
      });

    });
  });

    it('find should order by id if the order is not set for the query filter',
        function (done) {
          PostWithStringId.create({id: '2', title: 'c', content: 'CCC'}, function (err, post) {
            PostWithStringId.create({id: '1', title: 'd', content: 'DDD'}, function (err, post) {
              PostWithStringId.find(function (err, posts) {
                should.not.exist(err);
                posts.length.should.be.equal(2);
                posts[0].id.should.be.equal('1');

                PostWithStringId.find({limit: 1, offset: 0}, function (err, posts) {
                  should.not.exist(err);
                  posts.length.should.be.equal(1);
                  posts[0].id.should.be.equal('1');

                  PostWithStringId.find({limit: 1, offset: 1}, function (err, posts) {
                    should.not.exist(err);
                    posts.length.should.be.equal(1);
                    posts[0].id.should.be.equal('2');
                    done();
                  });
                });
              });
            });
          });
        });

      it('should report error on duplicate keys', function (done) {
        Post.create({title: 'd', content: 'DDD'}, function (err, post) {
          Post.create({id: post.id, title: 'd', content: 'DDD'}, function (err, post) {
            should.exist(err);
            done();
          });
        });
      });

      // it('should allow to find using like', function (done) {
      //     Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
      //       Post.find({where: {title: {like: 'M.+st'}}}, function (err, posts) {
      //         should.not.exist(err);
      //         posts.should.have.property('length', 1);
      //         done();
      //       });
      //     });
      //   });

      //   it('should allow to find using case insensitive like', function (done) {
      //     Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
      //       Post.find({where: {title: {like: 'm.+st', options: 'i'}}}, function (err, posts) {
      //         should.not.exist(err);
      //         posts.should.have.property('length', 1);
      //         done();
      //       });
      //     });
      //   });

      //   it('should allow to find using case insensitive like', function (done) {
      //     Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
      //       Post.find({where: {content: {like: 'HELLO', options: 'i'}}}, function (err, posts) {
      //         should.not.exist(err);
      //         posts.should.have.property('length', 1);
      //         done();
      //       });
      //     });
      //   });

      //   it('should support like for no match', function (done) {
      //     Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
      //       Post.find({where: {title: {like: 'M.+XY'}}}, function (err, posts) {
      //         should.not.exist(err);
      //         posts.should.have.property('length', 0);
      //         done();
      //       });
      //     });
      //   });

      //   it('should allow to find using nlike', function (done) {
      //     Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
      //       Post.find({where: {title: {nlike: 'M.+st'}}}, function (err, posts) {
      //         should.not.exist(err);
      //         posts.should.have.property('length', 0);
      //         done();
      //       });
      //     });
      //   });

      //   it('should allow to find using case insensitive nlike', function (done) {
      //     Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
      //       Post.find({where: {title: {nlike: 'm.+st', options: 'i'}}}, function (err, posts) {
      //         should.not.exist(err);
      //         posts.should.have.property('length', 0);
      //         done();
      //       });
      //     });
      //   });

      //   it('should support nlike for no match', function (done) {
      //     Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
      //       Post.find({where: {title: {nlike: 'M.+XY'}}}, function (err, posts) {
      //         should.not.exist(err);
      //         posts.should.have.property('length', 1);
      //         done();
      //       });
      //     });
      //   });

      it('should support "and" operator that is satisfied', function (done) {
          Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
            Post.find({where: {and: [{title: 'My Post'}, {content: 'Hello'}]}}, function (err, posts) {
              should.not.exist(err);
              posts.should.have.property('length', 1);
              done();
            });
          });
        });

        it('should support "and" operator that is not satisfied', function (done) {
          Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
            Post.find({where: {and: [{title: 'My Post'}, {content: 'Hello1'}]}}, function (err, posts) {
              should.not.exist(err);
              posts.should.have.property('length', 0);
              done();
            });
          });
        });

        it('should support "or" that is satisfied', function (done) {
          Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
            Post.find({where: {or: [{title: 'My Post'}, {content: 'Hello1'}]}}, function (err, posts) {
              should.not.exist(err);
              posts.should.have.property('length', 1);
              done();
            });
          });
        });

        it('should support "or" operator that is not satisfied', function (done) {
          Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
            Post.find({where: {or: [{title: 'My Post1'}, {content: 'Hello1'}]}}, function (err, posts) {
              should.not.exist(err);
              posts.should.have.property('length', 0);
              done();
            });
          });
        });

        it('should support "nor" operator that is satisfied', function (done) {
          Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
            Post.find({where: {nor: [{title: 'My Post1'}, {content: 'Hello1'}]}}, function (err, posts) {
              should.not.exist(err);
              posts.should.have.property('length', 1);
              done();
            });
          });
        });

        it('should support "nor" operator that is not satisfied', function (done) {
          Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
            Post.find({where: {nor: [{title: 'My Post'}, {content: 'Hello1'}]}}, function (err, posts) {
              should.not.exist(err);
              posts.should.have.property('length', 0);
              done();
            });
          });
        });

        it('should support neq for match', function (done) {
          Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
            Post.find({where: {title: {neq: 'XY'}}}, function (err, posts) {
              should.not.exist(err);
              posts.should.have.property('length', 1);
              done();
            });
          });
        });

        it('should support neq for no match', function (done) {
          Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
            Post.find({where: {title: {neq: 'My Post'}}}, function (err, posts) {
              should.not.exist(err);
              posts.should.have.property('length', 0);
              done();
            });
          });
        });

        // The where object should be parsed by the connector
        it('should support where for count', function (done) {
          Post.create({title: 'My Post', content: 'Hello'}, function (err, post) {
            Post.count({and: [{title: 'My Post'}, {content: 'Hello'}]}, function (err, count) {
              should.not.exist(err);
              count.should.be.equal(1);
              Post.count({and: [{title: 'My Post1'}, {content: 'Hello'}]}, function (err, count) {
                should.not.exist(err);
                count.should.be.equal(0);
                done();
              });
            });
          });
        });

        // The where object should be parsed by the connector
        it('should support where for destroyAll', function (done) {
          Post.create({title: 'My Post1', content: 'Hello'}, function (err, post) {
            Post.create({title: 'My Post2', content: 'Hello'}, function (err, post) {
              Post.destroyAll({and: [
                {title: 'My Post1'},
                {content: 'Hello'}
              ]}, function (err) {
                should.not.exist(err);
                Post.count(function (err, count) {
                  should.not.exist(err);
                  count.should.be.equal(1);
                  done();
                });
              });
            });
          });
        });

        // context('regexp operator', function() {
        //     before(function deleteExistingTestFixtures(done) {
        //       Post.destroyAll(done);
        //     });
        //     beforeEach(function createTestFixtures(done) {
        //       Post.create([
        //         {title: 'a', content: 'AAA'},
        //         {title: 'b', content: 'BBB'}
        //       ], done);
        //     });
        //     after(function deleteTestFixtures(done) {
        //       Post.destroyAll(done);
        //     });

        //     context('with regex strings', function() {
        //       context('using no flags', function() {
        //         it('should work', function(done) {
        //           Post.find({where: {content: {regexp: '^A'}}}, function(err, posts) {
        //             should.not.exist(err);
        //             posts.length.should.equal(1);
        //             posts[0].content.should.equal('AAA');
        //             done();
        //           });
        //         });
        //       });

        //       context('using flags', function() {
        //         beforeEach(function addSpy() {
        //           sinon.stub(console, 'warn');
        //         });
        //         afterEach(function removeSpy() {
        //           console.warn.restore();
        //         });

        //         it('should work', function(done) {
        //           Post.find({where: {content: {regexp: '^a/i'}}}, function(err, posts) {
        //             should.not.exist(err);
        //             posts.length.should.equal(1);
        //             posts[0].content.should.equal('AAA');
        //             done();
        //           });
        //         });

        //         it('should print a warning when the global flag is set',
        //             function(done) {
        //           Post.find({where: {content: {regexp: '^a/g'}}}, function(err, posts) {
        //             console.warn.calledOnce.should.be.ok;
        //             done();
        //           });
        //         });
        //       });
        //     });

        //     context('with regex literals', function() {
        //       context('using no flags', function() {
        //         it('should work', function(done) {
        //           Post.find({where: {content: {regexp: /^A/}}}, function(err, posts) {
        //             should.not.exist(err);
        //             posts.length.should.equal(1);
        //             posts[0].content.should.equal('AAA');
        //             done();
        //           });
        //         });
        //       });


        //       context('using flags', function() {
        //         beforeEach(function addSpy() {
        //           sinon.stub(console, 'warn');
        //         });
        //         afterEach(function removeSpy() {
        //           console.warn.restore();
        //         });

        //         it('should work', function(done) {
        //           Post.find({where: {content: {regexp: /^a/i}}}, function(err, posts) {
        //             should.not.exist(err);
        //             posts.length.should.equal(1);
        //             posts[0].content.should.equal('AAA');
        //             done();
        //           });
        //         });

        //         it('should print a warning when the global flag is set',
        //             function(done) {
        //           Post.find({where: {content: {regexp: /^a/g}}}, function(err, posts) {
        //             console.warn.calledOnce.should.be.ok;
        //             done();
        //           });
        //         });
        //       });
        //     });

        //     context('with regex object', function() {
        //       context('using no flags', function() {
        //         it('should work', function(done) {
        //           Post.find({where: {content: {regexp: new RegExp(/^A/)}}}, function(err, posts) {
        //             should.not.exist(err);
        //             posts.length.should.equal(1);
        //             posts[0].content.should.equal('AAA');
        //             done();
        //           });
        //         });
        //       });


        //       context('using flags', function() {
        //         beforeEach(function addSpy() {
        //           sinon.stub(console, 'warn');
        //         });
        //         afterEach(function removeSpy() {
        //           console.warn.restore();
        //         });

        //         it('should work', function(done) {
        //           Post.find({where: {content: {regexp: new RegExp(/^a/i)}}}, function(err, posts) {
        //             should.not.exist(err);
        //             posts.length.should.equal(1);
        //             posts[0].content.should.equal('AAA');
        //             done();
        //           });
        //         });

        //         it('should print a warning when the global flag is set',
        //             function(done) {
        //           Post.find({where: {content: {regexp: new RegExp(/^a/g)}}}, function(err, posts) {
        //             console.warn.calledOnce.should.be.ok;
        //             done();
        //           });
        //         });
        //       });
        //     });
        //   });


  after(function (done) {
      User.destroyAll(function () {
        Post.destroyAll(done);
      });
    });

  

});