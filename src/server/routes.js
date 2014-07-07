var express = require('express'),
    consolidate = require('consolidate'),
    compression = require('compression'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    flash = require('connect-flash'),

    marked = require('marked'),
    moment = require('moment'),
    url = require('url'),
    path = require('path'),
    Q = require('q'),
    content = require('./middleware/content.js'),
    navigation = require('./middleware/content.js');

var db,
    navigation = [];

module.exports = function(mystik) {
    var deferred = Q.defer();
    console.log('Configuring Express routes...');

    db = mystik.db;

    var app = express(),
        defaultRouter = express.Router(),
        staticRouter = express.Router();

    // Use Handlebars as templating engine
    app.engine('html', consolidate.handlebars);
    app.set('view engine', 'html');
    app.set('views', path.join(process.cwd(), 'templates'));

    // Route for handling static content serving...
    // Workaround for Express seemingly not setting the content-type header, causing compression to fail...
    staticRouter.use(function(req, res, next) {
        if (/^.*[.]js$/.test(req.path)) {
            res.set('Content-Type', 'application/javascript');
        } else if (/^.*[.]css$/.test(req.path)) {
            res.set('Content-Type', 'text/css');
        }

        next();
    });
    staticRouter.use(compression({threshold: 512}));
    staticRouter.use(express.static(path.join(process.cwd(), 'static')));
    app.use('/static', staticRouter);

    // Compress any content larger than 512 bytes
    defaultRouter.use(compression({threshold: 512}));

    // Setup POST handling
    defaultRouter.use(bodyParser.json());
    defaultRouter.use(bodyParser.urlencoded({"extended": true}));
    // app.use(express.multipart()); // Security concerns - see: https://groups.google.com/forum/#!msg/express-js/iP2VyhkypHo/5AXQiYN3RPcJ

    // Setup security middleware
    defaultRouter.use(cookieParser());
    defaultRouter.use(session({secret: 'jwnmoiw90kwqln0qkwetr8re9wlq0ree1', cookie: {maxAge: 15 * 60 * 1000}}));

    // Setup security middleware
    defaultRouter.use(mystik.passport.initialize());
    defaultRouter.use(mystik.passport.session());

    // Enable functionality to put flash messages in the session
    defaultRouter.use(flash());

    // Routes
    app.use('/*', defaultRouter);
    app.get('/*', handleGET);

    app.post('/login', mystik.passport.authenticate('local-login', {failureRedirect: '/login', failureFlash: true}), function(req, res) {
        if (req.body.path !== undefined) {
            res.redirect(req.body.path);
        } else {
            res.redirect('/');
        }
    });

    app.post('/*', handlePOST);

    mystik.server = app;
    deferred.resolve(mystik);
    return deferred.promise;
};

function handleGET(req, res) {
    var reqPath = url.parse(req.url).pathname;

    // Split path and remove any empty elements
    reqPath = reqPath.split('/').filter(function(e) {
        return e.length > 0;
    });

    // Handle the index page
    if (reqPath.length === 0) {
        renderNode('/', req, res, db);
        return;
    }

    // Handle special URLs
    var actionStr = reqPath[reqPath.length - 1],
        action;

    if (actionStr === 'login') {
        action = renderLogin;
        reqPath = reqPath.slice(0, reqPath.length - 1);
    } else if (actionStr === 'create') {
        action = renderCreate;
        reqPath = reqPath.slice(0, reqPath.length - 1);
    } else if (actionStr === 'edit') {
        action = renderEdit;
        reqPath = reqPath.slice(0, reqPath.length - 1);
    } else if (actionStr === 'delete') {
        action = renderDelete;
        reqPath = reqPath.slice(0, reqPath.length - 1);
    } else {
        action = renderNode;
    }

    if (reqPath.length === 0) {
        reqPath = '/';
    } else {
        reqPath = [''].concat(reqPath).join('/');
    }

    action(reqPath, req, res, db);
}

function handlePOST(req, res) {
    // TODO: Check for login - not logged in is either an attempt to do something bad, or a timed out session which will lose the edited content...
    var reqPath = url.parse(req.url).pathname;

    // Split path and remove any empty elements
    reqPath = reqPath.split('/').filter(function(e) {
        return e.length > 0;
    });

    // Handle special URLs
    var actionStr = reqPath[reqPath.length - 1],
        action;

    if (actionStr === 'save') {
        reqPath = reqPath.slice(0, reqPath.length - 1);

        if (reqPath.length === 0) {
            reqPath = '/';
        } else {
            reqPath = [''].concat(reqPath).join('/');
        }

        db.nodes.update({path: reqPath},
            {$set: {body: req.body.body, title: req.body.title, date: moment()}},
            {}, // options
            function(err, numReplaced) {
                if (err !== null) {
                    errorInternal(req, res, err);
                    return;
                }

                res.redirect(reqPath);
            });
    } else if (actionStr === 'create') {
        reqPath = reqPath.slice(0, reqPath.length - 1);

        if (reqPath.length === 0) {
            reqPath = '/';
        } else {
            reqPath = [''].concat(reqPath).join('/');
        }

        db.nodes.findOne({path: reqPath}, function(err, parentNode) {
            if (err !== null) {
                console.log('Error while finding parent node ' + reqPath + ' to add child to: ', err);
                errorInternal(req, res, err);
                return;
            }

            if (parentNode === null) {
                errorInternal(req, res, 'Could not find parent node ' + reqPath + ' to add child to...');
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

                res.redirect(newNode.path);
            });
        });
    }
}

function renderLogin(reqPath, req, res, db) {
    res.render('login', {message: req.flash('loginMessage'), path: reqPath});
}

function renderNode(reqPath, req, res, db) {
    db.nodes.findOne({path: reqPath}, function(err, node) {
        if (err !== null) {
            errorInternal(req, res, err);
            return;
        }

        if (node === null) {
            errorPageNotFound(req, res);
            return;
        }

        db.users.findOne({_id: node.author_id}, function(err, user) {
            if (err !== null) {
                errorInternal(req, res, err);
                return;
            }

            if (user === null) {
                errorUserNotFound(req, res);
                return;
            }

            buildModel(node, req, user)
                .then(function(model) {
                    res.render('index', model);
                });
        });
    });
}

function renderCreate(reqPath, req, res, db) {
    if (!req.isAuthenticated()) {
        res.redirect([reqPath, 'login'].join('/'));
        return;
    }

    db.nodes.findOne({path: reqPath}, function(err, parentNode) {
        if (err !== null) {
            errorInternal(req, res, err);
            return;
        }

        if (parentNode === null) {
            errorPageNotFound(req, res);
            return;
        }

        buildModelForEditOrCreate(null, parentNode, req)
            .then(function(model) {
                res.render('create', model);
            });
    });
}

function renderEdit(reqPath, req, res, db) {
    if (!req.isAuthenticated()) {
        res.redirect([reqPath, 'login'].join('/'));
        return;
    }

    var targetNode = null;

    getNode(reqPath)
        .then(function(node) {
            targetNode = node;

            if (targetNode === null) {
                errorPageNotFound(req, res);
            }

            return node;
        })
        .then(getParent)
        .then(function(parent) {
            return buildModelForEditOrCreate(targetNode, parent, req);
        })
        .then(function(model) {
            res.render('edit', model);
        });
}

function renderDelete(reqPath, req, res, db) {
    if (!req.isAuthenticated()) {
        res.redirect([reqPath, 'login'].join('/'));
        return;
    }

    if (reqPath === '/') {
        req.flash('flash', 'Cannot delete the site root (/).');
        res.redirect('/');
        return;
    }

    db.nodes.remove(
        {path: reqPath},
        {}, // options
        function(err, numRemoved) {
            if (err !== null) {
                errorInternal(req, res, err);
                return;
            }

            if (numRemoved === 1) {
                req.flash('flash', 'Deleted ' + reqPath + '.');
            } else {
                req.flash('flash', 'Failed to delete: ' + reqPath + ' not found...');
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
    var reqPath = node.path;
    if (node.path === '/') { // Special case to make edit / login links from root work
        reqPath = '';
    }

    return getNavigation()
        .then(function(navigation) {
            return {
                author: author,
                content: marked(node.body),
                currentUser: req.user,
                path: reqPath,
                title: node.title,
                timestamp: moment(node.date).format("Do MMMM YYYY"),
                flash: req.flash('flash'),
                navigation: navigation
            };
        });
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
        var reqPath = node.path;
        if (node.path === '/') { // Special case to make edit / login links from root work
            reqPath = '';
        }

        return getNavigation()
            .then(function(navigation) {
                return {
                    currentUser: req.user,
                    title: node.title,
                    basePath: basePath,
                    path: reqPath,
                    parentId: parentId,
                    body: node.body,
                    timestamp: moment(node.date).format("Do MMMM YYYY"),
                    flash: req.flash('flash'),
                    navigation: navigation
                };
            });
    } else { // create
        return getNavigation()
            .then(function(navigation) {
                return {
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
            });
    }
}

function getNavigation() {
    var root = null;

    return getRootNode()
        .then(function(rootNode) {
            root = rootNode;
            return root;
        })
        .then(getChildNodes)
        .then(function(nodes) {
            navigation = [];
            navigation.push(root);
            navigation = navigation.concat(nodes);
            return navigation;
        });
}

function getRootNode() {
    return getNode('/');
}

function getNode(reqPath) {
    var deferred = Q.defer();

    db.nodes.findOne({path: reqPath}, function(err, node) {
        if (err !== null) {
            deferred.reject(new Error('No path "%s" defined in database.', reqPath));
        } else {
            deferred.resolve(node);
        }
    });

    return deferred.promise;
}

function getParent(node) {
    var deferred = Q.defer();

    db.nodes.findOne({_id: node.parent_id}, function(err, parent) {
        if (err !== null) {
            deferred.reject(new Error('Parent node with ID %s not found.', node.parent_id));
        } else {
            deferred.resolve(parent);
        }
    });

    return deferred.promise;
}

function getChildNodes(node) {
    var deferred = Q.defer();

    db.nodes.find({parent_id: node._id}, function(err, nodes) {
        if (err !== null) {
            deferred.reject(new Error('Error finding child nodes of "' + node.path + '".'));
        } else {
            deferred.resolve(nodes);
        }
    });

    return deferred.promise;
}