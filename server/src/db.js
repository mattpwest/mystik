var config = require('configure'),
    path = require('path'),
    moment = require('moment'),
    Datastore = require('nedb');        // Simple in-memory db with a subset of mongodb's API

module.exports = function setupDatabase(config) {
    var database = {
        users: new Datastore({filename: path.join(process.cwd(), 'db', 'users.nedb')}),
        nodes: new Datastore({filename: path.join(process.cwd(), 'db', 'nodes.nedb')})
    };
    
    database.users.loadDatabase(function(err) {
        if (err != null) {
            console.log('Failed to load user database: ', err);
            system.exit(-1);
        }

        createDefaultAdminUser(database, function(err, user) {
            if (err != null) {
                console.log('Failed to create default admin user: ', err);
                system.exit(-1);
            }

            database.nodes.loadDatabase(function(err) {
                if (err != null) {
                    console.log('Failed to load nodes database: ', err);
                    system.exit(-1);
                }

                createDefaultNodes(database, user);
            });
        });
    });

    return database;
}

function createDefaultAdminUser(database, callback) {
    database.users.findOne({email: 'admin@chaotik.co.za'}, function(err, user) {
        if (user != null) {
            callback(null, user);
            return;
        }

        database.users.insert({
            email: 'admin@chaotik.co.za',
            firstname: 'Default',
            lastname: 'Admin',
            password: 'admin'
        }, function(err, newUser) {
            if (err !== null) {
                console.log('Failed to create default admin user: ' + err, user);
                callback(err, null);
            }

            console.log('Created default admin user...');

            callback(null, newUser);
        });
    });
}

function createDefaultNodes(database, defaultUser) {
    var now = moment();

    database.nodes.findOne({path: '/'}, function(err, node) {
        if (node == null) {
            database.nodes.insert({
                parent_id: null,
                author_id: defaultUser._id,
                path: '/',
                title: 'Home Page',
                body: '## Markdown Content\nThis is some nice *content* written in [Markdown](http://whatismarkdown.com/).\nThings that are awesome:\n1. NodeJS\n2. Games\n3. Websites\n',
                comments: [{body: 'Test comment :)!', date: now, user_id: defaultUser._id}],
                date: now,
                status: 'published'
            }, function(err, newNode) {
                console.log('Created default / page.');
            });
        }
    });

    database.nodes.find({}, function(err, nodes) {
        nodes.forEach(function(node) {
            console.log('Page: ', node.path);
        })
    });

    /* TODO:
        /config
        /users
        500 error page? Or just as templates...
        404 error page? Or just as templates...g
    */
}