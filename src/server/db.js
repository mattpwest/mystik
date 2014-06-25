var config = require('configure'),
    path = require('path'),
    moment = require('moment'),
    Datastore = require('nedb'),
    Q = require('q');

module.exports = function initDatabase(mystik) {

    var defaultAdmin = null;

    return loadDatabase(new Datastore({filename: path.join(process.cwd(), 'db', 'settings.nedb')}))
        .then(function(settingsDb) {
            mystik.db.settings = settingsDb;
            return settingsDb;
        })
        .then(loadOrCreateSettings)
        .then(function(settings) {
            console.log('\tLoaded settings...');
            mystik.settings = settings;

            return loadDatabase(new Datastore({filename: path.join(process.cwd(), 'db', 'users.nedb')}));
        })
        .then(function(userDb) {
            mystik.db.users = userDb;
            return userDb;
        })
        .then(loadOrCreateAdminUser)
        .then(function(defaultAdminUser) {
            console.log('\tLoaded default admin user...');
            defaultAdmin = defaultAdminUser;

            return loadDatabase(new Datastore({filename: path.join(process.cwd(), 'db', 'nodes.nedb')}));
        })
        .then(function(nodesDb) {
            mystik.db.nodes = nodesDb;
            return loadOrCreateRootNode(nodesDb, defaultAdmin);
        }).then(function(rootNode) {
            console.log('\tLoaded root node...');
            mystik.root = rootNode;

            return mystik;
        });
};

function loadDatabase(db) {
    var deferred = Q.defer();
    db.loadDatabase(function(err) {
        if (err !== null) {
            deferred.reject(new Error(err));
        } else {
            console.log('Loaded ', db.filename, '...');
            deferred.resolve(db);
        }
    });
    return deferred.promise;
}

function loadOrCreateSettings(db) {
    var deferred = Q.defer();

    db.findOne({}).sort({version: -1}).limit(1).exec(function(err, settings) {
        if (settings !== null) {
            deferred.resolve(settings);
        } else {
            db.insert({
                theme: 'default',
                version: '1'
            }, function(err, newSettings) {
                if (err !== null) {
                    deferred.reject(new Error('Failed to create default settings: ' + err));
                } else {
                    deferred.resolve(newSettings);
                }
            });
        }
    });

    return deferred.promise;
}

function loadOrCreateAdminUser(db) {
    var deferred = Q.defer();

    db.findOne({email: 'admin@chaotik.co.za'}, function(err, user) {
        if (user !== null) {
            deferred.resolve(user);
        } else {
            db.insert({
                email: 'admin@chaotik.co.za',
                firstname: 'Default',
                lastname: 'Admin',
                password: 'admin'
            }, function(err, newUser) {
                if (err !== null) {
                    console.log('Failed to create admin');
                    deferred.reject(new Error('Failed to create default admin user: ' + err));
                } else {
                    console.log('Created default admin');
                    deferred.resolve(newUser);
                }
            });
        }
    });

    return deferred.promise;
}

function loadOrCreateRootNode(db, defaultUser) {
    var deferred = Q.defer();

    var now = moment();
    db.findOne({path: '/'}, function(err, node) {
        if (node !== null) {
            deferred.resolve(node);
        } else {
            db.insert({
                parent_id: null,
                author_id: defaultUser._id,
                path: '/',
                title: 'Home Page',
                body: '## Markdown Content\nThis is some nice *content* written in [Markdown](http://whatismarkdown.com/).\nThings that are awesome:\n1. NodeJS\n2. Games\n3. Websites\n',
                comments: [{body: 'Test comment :)!', date: now, user_id: defaultUser._id}],
                date: now,
                status: 'published'
            }, function(err, newNode) {
                if (err !== null) {
                    deferred.reject(new Error('Failed to create default root page: ' + err));
                } else {
                    deferred.resolve(newNode);
                }
            });
        }
    });

    return deferred.promise;

    /* TODO:
        /config
        /users
        500 error page? Or just as templates...
        404 error page? Or just as templates...g
    */
}

function debugListPages(database) {
    var deferred = Q.defer();

    database.nodes.find({}, function(err, nodes) {
        if (err !== null) {
            deferred.reject(err);
        } else {
            nodes.forEach(function(node) {
                console.log('Page: ', node.path);
            });
            deferred.resolve();
        }
    });

    return deferred.promise;
}