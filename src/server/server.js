var express = require('express'),
    consolidate = require('consolidate'),
    flash = require('connect-flash'),
    path = require('path'),
    Q = require('q');

module.exports = function(mystik) {
    var deferred = Q.defer();
    var app = express();
    console.log('Configuring Express...');

    // Compress static content
    app.use(express.compress());

    // Define path to static content
    app.use('/static', express.static(path.join(process.cwd(), 'static')));

    // Setup POST handling
    app.use(express.json());
    app.use(express.urlencoded());
    // app.use(express.multipart()); // Security concerns - see: https://groups.google.com/forum/#!msg/express-js/iP2VyhkypHo/5AXQiYN3RPcJ

    // Setup security middleware
    app.use(express.cookieParser());
    app.use(express.session({secret: 'jwnmoiw90kwqln0qkwetr8re9wlq0ree1', cookie: {maxAge: 15 * 60 * 1000}}));
    app.use(mystik.passport.initialize());
    app.use(mystik.passport.session());

    // Enable functionality to put flash messages in the session
    app.use(flash());

    // Use Handlebars as templating engine
    app.engine('html', consolidate.handlebars);
    app.set('view engine', 'html');
    app.set('views', path.join(process.cwd(), 'templates'));

    mystik.server = app;

    deferred.resolve(mystik);

    return deferred.promise;
};