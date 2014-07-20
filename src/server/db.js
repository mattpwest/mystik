var config = require('configure'),
    path = require('path'),
    moment = require('moment'),
    Datastore = require('nedb'),
    Q = require('q'),
    dbUpgrade = require('./dbUpgrade.js');

module.exports = function initDatabase(mystik) {

    return Q.all([
            loadDatabase(new Datastore({filename: path.join(process.cwd(), 'db', 'version.nedb')})),
            loadDatabase(new Datastore({filename: path.join(process.cwd(), 'db', 'settings.nedb')})),
            loadDatabase(new Datastore({filename: path.join(process.cwd(), 'db', 'users.nedb')})),
            loadDatabase(new Datastore({filename: path.join(process.cwd(), 'db', 'nodes.nedb')}))
        ])
        .then(function(databases) {
            console.log('Loaded %d databases...', databases.length);
            mystik.db.version = databases[0];
            mystik.db.settings = databases[1];
            mystik.db.users = databases[2];
            mystik.db.nodes = databases[3];

            return mystik;
        })
        .then(dbUpgrade);
        /*
        .then(loadSettings)
        .then(function(settings) {
            mystik.settings = settings;
            return mystik;
        })
        .then(loadRootNode)
        .then(function(rootNode) {
            mystik.root = rootNode;
            return mystik;
        });*/
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

function loadSettings(mystik) {
    var deferred = Q.defer();

    mystik.db.settings.findOne({}).sort({version: -1}).limit(1).exec(function(err, settings) {
        if (err !== null) {
            deferred.reject(new Error('Failed to load settings from database: ', err));
        } else if (settings === null) {
            deferred.reject(new Error('No settings found in database...'));
        } else {
            deferred.resolve(settings);
        }
    });

    return deferred.promise;
}

function loadRootNode(mystik) {
    var deferred = Q.defer();

    mystik.db.nodes.findOne({path: '/'}, function(err, node) {
        if (err !== null) {
            deferred.reject(new Error('Failed to load root node from database: ', err));
        } else if (node === null) {
            deferred.reject(new Error('No root node found in database...'));
        } else {
            deferred.resolve(node);
        }
    });

    return deferred.promise;
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