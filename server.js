var config = require('configure'),
    console = require('console'),
    passport = require('passport'),
    handlebars = require('handlebars');

var db = require('./server/src/db.js')(config),
    templates = require('./server/src/templates.js')(config, handlebars),
    security = require('./server/src/security.js')(passport, db),
    server = require('./server/src/server.js')(config, passport),
    routes = require('./server/src/routes.js')(server, passport, db);

startServer(server);

function startServer(server) {
    var instance = server.listen(config.port, function() {
    	console.log('Mystik CMS started - listening on port %d', instance.address().port);
    });

    module.exports = instance;
}