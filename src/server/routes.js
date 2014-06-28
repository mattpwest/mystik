var marked = require('marked'),
    moment = require('moment'),
    url = require('url'),
    Q = require('q');

var navigation = [];

module.exports = function(mystik) {
    var deferred = Q.defer();
    console.log('Configuring routes...');

    updateNavigation(mystik.db);

    mystik.server.get('/*', function(req, res) {
        handleGET(req, res, mystik.db);
    });

    mystik.server.post('/login',
        mystik.passport.authenticate('local-login', {failureRedirect: '/login', failureFlash: true}),
        function(req, res) {
            if (req.body.path !== undefined) {
                res.redirect(req.body.path);
            } else {
                res.redirect('/');
            }
        });

    mystik.server.post('/*', function(req, res) {
        handlePOST(req, res, mystik.db);
    });

    deferred.resolve(mystik);
    return deferred.promise;
};

function handleGET(req, res, db) {
    var path = url.parse(req.url).pathname;

    // Split path and remove any empty elements
    path = path.split('/').filter(function(e) {
        return e.length > 0;
    });

    // Handle the index page
    if (path.length === 0) {
        renderNode('/', req, res, db);
        return;
    }

    // Handle special URLs
    var actionStr = path[path.length - 1],
        action;

    if (actionStr === 'login') {
        action = renderLogin;
        path = path.slice(0, path.length - 1);
    } else if (actionStr === 'create') {
        action = renderCreate;
        path = path.slice(0, path.length - 1);
    } else if (actionStr === 'edit') {
        action = renderEdit;
        path = path.slice(0, path.length - 1);
    } else if (actionStr === 'delete') {
        action = renderDelete;
        path = path.slice(0, path.length - 1);
    } else {
        action = renderNode;
    }

    if (path.length === 0) {
        path = '/';
    } else {
        path = [''].concat(path).join('/');
    }

    action(path, req, res, db);
}

function handlePOST(req, res, db) {
    // TODO: Check for login - not logged in is either an attempt to do something bad, or a timed out session which will lose the edited content...
    var path = url.parse(req.url).pathname;

    // Split path and remove any empty elements
    path = path.split('/').filter(function(e) {
        return e.length > 0;
    });

    // Handle special URLs
    var actionStr = path[path.length - 1],
        action;

    if (actionStr === 'save') {
        path = path.slice(0, path.length - 1);

        if (path.length === 0) {
            path = '/';
        } else {
            path = [''].concat(path).join('/');
        }

        db.nodes.update({path: path},
            {$set: {body: req.body.body, title: req.body.title, date: moment()}},
            {}, // options
            function(err, numReplaced) {
                if (err !== null) {
                    errorInternal(req, res, err);
                    return;
                }

                updateNavigation(db);

                res.redirect(path);
            });
    } else if (actionStr === 'create') {
        path = path.slice(0, path.length - 1);

        if (path.length === 0) {
            path = '/';
        } else {
            path = [''].concat(path).join('/');
        }

        db.nodes.findOne({path: path}, function(err, parentNode) {
            if (err !== null) {
                console.log('Error while finding parent node ' + path + ' to add child to: ', err);
                errorInternal(req, res, err);
                return;
            }

            if (parentNode === null) {
                errorInternal(req, res, 'Could not find parent node ' + path + ' to add child to...');
                return;
            }

            var newPath = '';
            if (parentNode.path === '/') {
                newPath = parentNode.path + req.body.path;
            } else {
                newPath = [parentNode.path, req.body.path].join('/');
            }

            db.nodes.insert({
                parent_id: parentNode._id,
                author_id: req.user._id,
                path: newPath,
                title: req.body.title,
                body: req.body.body,
                comments: [],
                date: moment(),
                status: 'published'
            }, function(err, newNode) {
                if (err !== null) {
                    errorInternal(req, res, err);
                    return;
                }

                updateNavigation(db);

                res.redirect(newNode.path);
            });
        });
    }
}

function renderLogin(path, req, res, db) {
    res.render('login', {message: req.flash('loginMessage'), path: path});
}

function renderNode(path, req, res, db) {
    db.nodes.find({path: path}, function(err, nodes) {
        if (err !== null) {
            errorInternal(req, res, err);
            return;
        }

        if (nodes.length === 0) {
            errorPageNotFound(req, res);
            return;
        }

        var node = nodes[0];

        db.users.find({_id: node.author_id}, function(err, users) {
            if (err !== null) {
                errorInternal(req, res, err);
                return;
            }

            if (users.length === 0) {
                errorUserNotFound(req, res);
                return;
            }

            var author = users[0];

            res.render('index', buildModel(node, req, author));
        });
    });
}

function renderCreate(path, req, res, db) {
    if (!req.isAuthenticated()) {
        res.redirect([path, 'login'].join('/'));
        return;
    }

    db.nodes.findOne({path: path}, function(err, parentNode) {
        if (err !== null) {
            errorInternal(req, res, err);
            return;
        }

        if (parentNode === null) {
            errorPageNotFound(req, res);
            return;
        }

        res.render('create', buildModelForEditOrCreate(null, parentNode, req));
    });
}

function renderEdit(path, req, res, db) {
    if (!req.isAuthenticated()) {
        res.redirect([path, 'login'].join('/'));
        return;
    }

    db.nodes.findOne({path: path}, function(err, node) {
        if (err !== null) {
            errorInternal(req, res, err);
            return;
        }

        if (node === null) {
            errorPageNotFound(req, res);
            return;
        }

        db.nodes.findOne({_id: node.parent_id}, function(err, parent) {
            res.render('edit', buildModelForEditOrCreate(node, parent, req));
        });
    });
}

function renderDelete(path, req, res, db) {
    if (!req.isAuthenticated()) {
        res.redirect([path, 'login'].join('/'));
        return;
    }

    if (path === '/') {
        req.flash('flash', 'Cannot delete the site root (/).');
        res.redirect('/');
        return;
    }

    console.log('Deleting ', path);
    db.nodes.remove(
        {path: path},
        {}, // options
        function(err, numRemoved) {
            if (err !== null) {
                errorInternal(req, res, err);
                return;
            }

            if (numRemoved === 1) {
                req.flash('flash', 'Deleted ' + path + '.');
            } else {
                req.flash('flash', 'Failed to delete: ' + path + ' not found...');
            }
            res.redirect('/');
        });
}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the login page
    res.redirect('/login');
}

function errorInternal(req, res, err) {
    console.log(err);
    res.render('index', {content: '500 Internal server error: ' + err});
    // TODO: redirect to an actual 500 page
    // TODO: Set response codes
}

function errorPageNotFound(req, res) {
    res.render('index', {content: '404 Not found: "/"'});
    // TODO: Get path request from req and use in error message
    // TODO: redirect to an actual 404 page
    // TODO: Set response codes
}

function errorUserNotFound(req, res) {
    res.render('index', {content: '404 Not found: "/"'});
    // TODO: Get path request from req and use in error message
    // TODO: redirect to an actual 404 page
    // TODO: Set response codes
}

function buildModel(node, req, author) {
    var path = node.path;
    if (node.path === '/') { // Special case to make edit / login links from root work
        path = '';
    }

    var model = {
        author: author,
        content: marked(node.body),
        currentUser: req.user,
        path: path,
        title: node.title,
        timestamp: moment(node.date).format("Do MMMM YYYY"),
        flash: req.flash('flash'),
        navigation: navigation
    };

    return model;
}

function buildModelForEditOrCreate(node, parentNode, req) {
    var basePath = '/',
        parentId = null;
    if (parentNode !== null) {
        if (parentNode.path === '/') {
            basePath = parentNode.path;
        } else {
            basePath = parentNode.path + '/';
        }
        parentId = parentNode._id;
    }

    var model = {};
    if (node !== null) { // edit
        var path = node.path;
        if (node.path === '/') { // Special case to make edit / login links from root work
            path = '';
        }

        model = {
            currentUser: req.user,
            title: node.title,
            basePath: basePath,
            path: path,
            parentId: parentId,
            body: node.body,
            timestamp: moment(node.date).format("Do MMMM YYYY"),
            flash: req.flash('flash'),
            navigation: navigation
        };
    } else { // create
        model = {
            currentUser: req.user,
            title: '',
            basePath: basePath,
            path: '',
            parentId: parentId,
            body: '',
            timestamp: moment().format("Do MMMM YYYY"),
            flash: req.flash('flash'),
            navigation: navigation
        };

    }

    return model;
}

function updateNavigation(db) {
    navigation = [];
    db.nodes.findOne({path: '/'}, function(err, rootNode) {
        if (rootNode !== null) {
            navigation.push(rootNode);

            db.nodes.find({parent_id: rootNode._id}, function(err, nodes) {
                navigation = navigation.concat(nodes);
            });
        }
    });
}