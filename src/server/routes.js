var express = require('express'),
    consolidate = require('consolidate'),
    compression = require('compression'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    flash = require('connect-flash'),
    multer = require('multer'),
    fs = require('fs-extra'),

    marked = require('marked'),
    moment = require('moment'),
    url = require('url'),
    path = require('path'),
    Q = require('q');

var db,
    navigation = [];

module.exports = function(mystik) {
    var deferred = Q.defer();
    //console.log('Configuring Express routes...');

    db = mystik.db;

    var app = express(),
        defaultRouter = express.Router(),
        staticRouter = express.Router(),
        uploadRouter = express.Router();

    // Use Handlebars as templating engine
    app.engine('html', consolidate.handlebars);
    app.set('view engine', 'html');
    app.set('views', path.join(process.cwd(), 'templates'));

    // Route for handling static content serving...
    // Workaround for Express seemingly not setting the content-type header, causing compression to fail...
    staticRouter.use(function mystikFixContentTypeForCompression(req, res, next) {
        if (/^.*[.]js$/.test(req.path)) {
            res.set('Content-Type', 'application/javascript');
        } else if (/^.*[.]css$/.test(req.path)) {
            res.set('Content-Type', 'text/css');
        }

        next();
    });
    staticRouter.use(compression({threshold: 512}));
    staticRouter.use(express.static(path.join(process.cwd(), 'static')));
    staticRouter.use(mystikErrorCatchAll);
    app.use('/static', staticRouter);

    // File upload handler
    uploadRouter.use(multer({
        dest: path.join(process.cwd(), 'static', 'uploads'),
        limits: {
            fileSize: 10 * 1024 * 1024,
            files: 2
        }
    }));
    uploadRouter.use(mystikErrorCatchAll);

    uploadRouter.post('', function mystikHandleUploadPost(req, res) {
        var file = req.files.image,
            fromFilename = path.join(process.cwd(), 'static', 'uploads', file.name),
            toFilename = '';

        if (file.mimetype.split('/')[0] === 'image') {
            toFilename = path.join(process.cwd(), 'static', 'images', file.originalname);
        } else {
            toFilename = path.join(process.cwd(), 'static', 'files', file.originalname);
        }

        toFilename = toFilename.replace('.', '.' + moment().format('YYYYMMDDHHmmss') + '.');

        fs.move(fromFilename, toFilename, function(err) {
            if (err !== null) {
                console.log(err.stack);
                res.status(500).send({'error': + err});
            } else {
                //console.log('Upload %s saved as %s', file.originalname, toFilename);

                res.status(200).send({'error': null});
            }
        });
    });

    app.use('/upload', uploadRouter);

    // Compress any content larger than 512 bytes
    defaultRouter.use(compression({threshold: 512}));

    // Setup POST handling
    defaultRouter.use(bodyParser.json());
    defaultRouter.use(bodyParser.urlencoded({"extended": true}));

    // Setup security middleware
    defaultRouter.use(cookieParser());
    defaultRouter.use(session({
        resave: false,
        saveUninitialized: true,
        secret: 'jwnmoiw90kwqln0qkwetr8re9wlq0ree1',
        cookie: {maxAge: 15 * 60 * 1000}
    }));

    // Setup security middleware
    defaultRouter.use(mystik.passport.initialize());
    defaultRouter.use(mystik.passport.session());

    // Enable functionality to put flash messages in the session
    defaultRouter.use(flash());

    defaultRouter.use(mystikErrorCatchAll);

    defaultRouter.get('/favicon.ico', function mystikIgnoreFaviconRequests(req, res) {
        //console.log('Ignoring favicon request.');
        res.status(500).send('No favicon defined.');
    });
    defaultRouter.get('/api/images', listImages);
    defaultRouter.get('/logout', handleLogout);
    defaultRouter.get('/*', handleGET);

    defaultRouter.post('/login', mystik.passport.authenticate('local-login', {failureRedirect: '/login', failureFlash: true}), function(req, res) {
        //console.log('Handling login at %s', req.url);
        if ((req.body.path !== undefined) && (req.body.path !== '')) {
            //console.log('Redirecting to: %s', req.body.path);
            res.redirect(req.body.path);
        } else {
            //console.log('Redirecting to /');
            res.redirect('/');
        }
    });
    defaultRouter.post('/*', handlePOST);

    app.use(defaultRouter);

    mystik.server = app;
    deferred.resolve(mystik);
    return deferred.promise;
};

function mystikErrorCatchAll(err, req, res, next) {
    console.log(err.stack);
    res.status(500).send('Oops - something exploded!');
    next();
}

function listImages(req, res) {
    var imageDir = path.join(process.cwd(), 'static', 'images'),
        result = {
            images: [],
            error: null
        };

    fs.readdir(imageDir, function(err, files) {
        var images = [];
        if (err !== null) {
            result.error = new Error(err);
            res.status(500).send(result);
        } else {
            for (var i = 0; i < files.length; i++) {
                result.images.push(path.join('/', 'static', 'images', path.basename(files[i])));
            }

            res.status(200).send(result);
        }
    });

}

function handleLogout(req, res) {
    req.logout();
    res.redirect('/');
}

function handleGET(req, res) {
    var reqPath = url.parse(req.url).pathname;

    // Split path and remove any empty elements
    reqPath = reqPath.split('/').filter(function(e) {
        return e.length > 0;
    });

    //console.log('GET: %s', reqPath);

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

    //console.log('POST: %s - action = %s', reqPath, actionStr);

    if (actionStr === 'save') {
        reqPath = reqPath.slice(0, reqPath.length - 1);

        if (reqPath.length === 0) {
            reqPath = '/';
        } else {
            reqPath = [''].concat(reqPath).join('/');
        }

        //console.log('Saving %s', reqPath);
        db.nodes.update({path: reqPath},
            {$set: {body: req.body.body, title: req.body.title, type: req.body.type, date: moment()}},
            {}, // options
            function(err, numReplaced) {
                if (err !== null) {
                    console.log('Error saving...', err.stack);
                    errorInternal(req, res, err);
                } else {
                    res.redirect(reqPath);
                    //console.log('Redirecting to %s', reqPath);
                }
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
                status: 'published',
                type: req.body.type
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
    var node = null;

    getNode(reqPath)
        .then(function(targetNode) {
            node = targetNode;
            return node;
        })
        .then(getNodeAuthor)
        .then(function(author) {
            return buildModel(node, req, author);
        })
        .then(function(model) {
            model.message = req.flash('loginMessage');
            res.render('admin/login', model);
        });
}

function renderNode(reqPath, req, res, db) {
    var node = null;

    //console.log('mystik.renderNode(%s, ...)', reqPath);

    getNode(reqPath)
        .then(function(targetNode) {
            //console.log('mystik.renderNode: got target node');
            node = targetNode;
            return node;
        })
        .then(getNodeAuthor)
        .then(function(author) {
            //console.log('mystik.renderNode: got target node author');
            return buildModel(node, req, author);
        })
        .then(function(model) {
            //console.log('mystik.renderNode: rendering');
            res.render('pages/' + model.type, model);
        }, function(err) {
            if (err !== null) {
                console.log(err);
                console.log(err.stack);
                res.status(500).send('Error rendering node...');
            }
        });
}

function renderCreate(reqPath, req, res, db) {
    if (!req.isAuthenticated()) {
        res.redirect([reqPath, 'login'].join('/'));
        return;
    }

    var parentNode = null;
    return getNode(reqPath)
        .then(function(node) {
            parentNode = node;

            if (parentNode === null) {
                errorPageNotFound(req, res);
            }

            return buildModelForEditOrCreate(null, parentNode, req);
        })
        .then(function(model) {
            res.render('admin/create', model);
        }, function(err) {
            console.log('Error rendering /create: %s', err);
        })
        .done();
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
            res.render('admin/edit', model);
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
    if (req.isAuthenticated()) {
        //console.log('isAuthenticated: true');
        return next();
    } else {
        //console.log('isAuthenticated: false');
        // if they aren't redirect them to the login page
        res.redirect('/login');
    }
}

function errorInternal(req, res, err) {
    console.log(err.stack);
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
    //console.log('mystik.buildModel path: %s', reqPath);
    if (node.path === '/') { // Special case to make edit / login links from root work
        reqPath = '';
        //console.log('mystik.buildModel adjusted path: %s', reqPath);
    }

    var nav = null;
    return getNavigation()
        .then(function(navigation) {
            nav = navigation;
            //console.log('mystik.buildModel got navigation...');

            //console.log('mystik.buildModel generating content from markdown');
            return marked(node.body);
        })
        .then(function(bodyContent) {
            return {
                author: author,
                content: bodyContent,
                currentUser: req.user,
                path: reqPath,
                title: node.title,
                timestamp: moment(node.date).format("Do MMMM YYYY"),
                flash: req.flash('flash'),
                navigation: nav,
                type: node.type
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
                    navigation: navigation,
                    type: node.type
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
                    navigation: navigation,
                    type: 'page'
                };
            });
    }
}

function getNavigation() {
    //console.log('mystik.getNavigation()');
    var root = null;

    return getRootNode()
        .then(function(rootNode) {
            //console.log('mystik.getNavigation() got root node...');
            root = rootNode;
            return root;
        })
        .then(getChildNodes)
        .then(function(nodes) {
            //console.log('mystik.getNavigation() got child nodes...');
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
        if ((err !== null) || (node === null)) {
            deferred.reject(new Error('No path "' + reqPath + '" defined in database.'));
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

function getNodeAuthor(node) {
    var deferred = Q.defer();

    db.users.findOne({_id: node.author_id}, function(err, user) {
        if (err !== null) {
            deferred.reject(new Error('Failed to get author for node %s with error: %s', node.path, err));
        } else if (user === null) {
            deferred.reject(new Error('Failed to get author for node %s', node.path));
        } else {
            deferred.resolve(user);
        }
    });

    return deferred.promise;
}