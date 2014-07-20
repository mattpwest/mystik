var config = require('configure'),
    path = require('path'),
    moment = require('moment'),
    Q = require('q');

var upgrades = [
    {version: '0.1.0.alpha.2', dbVersion: 0,
        description: 'Initial database: populates any missing tables then adds the version table.', upgrade: upgrade0},
    {version: '0.1.0.alpha.3', dbVersion: 1,
        description: 'Adds page types to the nodes table.', upgrade: upgrade1}
];

module.exports = dbUpgrades;

function dbUpgrades(mystik) {
    return findNecessaryUpgrades(mystik)
        .then(function(neededUpgrades) {
            console.log('Need to apply %d database upgrades.', neededUpgrades.length);
            var result = Q(mystik);
            neededUpgrades.forEach(function(upgrade) {
                result = result
                    .then(function(mystik) {
                        return upgrade.upgrade(mystik);
                    })
                    .then(function(mystik) {
                        return recordUpgrade(mystik, upgrade);
                    });
            });
            return result;
        });
}

function findNecessaryUpgrades(mystik) {
    var deferred = Q.defer();

    mystik.db.version.findOne({}).sort({dbVersion: -1}).limit(1).exec(function(err, lastVersion) {
        if (err !== null) {
            deferred.reject(new Error('Error while checking database version: ' + err));
        } else if (lastVersion === null) {
            console.log('No version data found... applying all upgrades.');
            deferred.resolve(upgrades.slice(0));
        } else {
            var neededUpgrades = [];
            if (lastVersion.dbVersion < upgrades.length - 1) {
                neededUpgrades = upgrades.slice(lastVersion.dbVersion + 1);
            }

            deferred.resolve(neededUpgrades);
        }
    });

    return deferred.promise;
}

function recordUpgrade(mystik, upgrade) {
    var deferred = Q.defer();

    upgrade.applied = moment(); 
    mystik.db.version.insert(upgrade, function(err, version) {
        if (err !== null) {
            deferred.reject(new Error('Failed to record upgrade %d: %s', upgrade.dbVersion, err));
        } else {
            deferred.resolve(mystik);
        }
    });

    return deferred.promise;
}

function upgrade0(mystik) {
    return upgrade0_createDefaultSettings(mystik)
        .then(function(settings) {
            console.log('Database upgrade0 settings: done.');
            return mystik;
        })
        .then(option0_createAdminUser)
        .then(function(adminUser) {
            console.log('Database upgrade0 users: done.');
            return option0_createRootNode(mystik, adminUser);
        })
        .then(function(rootNode) {
            console.log('Database upgrade0 nodes: done.');
            return mystik;
        });
}

function upgrade0_createDefaultSettings(mystik) {
    var deferred = Q.defer();

    mystik.db.settings.findOne({}).sort({version: -1}).limit(1).exec(function(err, settings) {
        if (settings !== null) {
            deferred.resolve(settings);
        } else {
            mystik.db.settings.insert({
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

function option0_createAdminUser(mystik) {
    var deferred = Q.defer();

    mystik.db.users.findOne({email: 'admin@localhost'}, function(err, user) {
        if (user !== null) {
            deferred.resolve(user);
        } else {
            mystik.db.users.insert({
                email: 'admin@localhost',
                firstname: 'Default',
                lastname: 'Admin',
                password: 'admin'
            }, function(err, newUser) {
                if (err !== null) {
                    console.log('Failed to create admin');
                    deferred.reject(new Error('Failed to create default admin user: ' + err));
                } else {
                    deferred.resolve(newUser);
                }
            });
        }
    });

    return deferred.promise;
}

function option0_createRootNode(mystik, defaultAdmin) {
    var deferred = Q.defer();

    var now = moment();
    mystik.db.nodes.findOne({path: '/'}, function(err, node) {
        if (node !== null) {
            deferred.resolve(node);
        } else {
            mystik.db.nodes.insert({
                parent_id: null,
                author_id: defaultAdmin._id,
                path: '/',
                title: 'Home Page',
                body: '## Markdown Content\nThis is some nice *content* written in [Markdown](http://whatismarkdown.com/).\nThings that are awesome:\n1. NodeJS\n2. Games\n3. Websites\n',
                comments: [{body: 'Test comment :)!', date: now, user_id: defaultAdmin._id}],
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


function upgrade1(mystik) {
    var deferred = Q.defer();

    mystik.db.nodes.update({type: {$exists: false}, path: '/'}, {$set: {type: 'home'}}, {multi: false}, function(err, numUpdated) {
        if (err !== null) {
            deferred.reject(new Error('Failed to apply database upgrade1 to root node: ' + err));
        } else if (numUpdated !== 1) {
            deferred.reject(new Error('Cancelling update 1: it seems root node already has the update.'));
        } else {
            console.log('Added type attribute to root node.');
            mystik.db.nodes.update({type: {$exists: false}}, {$set: {type: 'page'}}, {multi: true}, function(err, numUpdated) {
                console.log('Database upgrade 1: done.');
                deferred.resolve(mystik);
            });
        }
    });

    return deferred.promise;
}