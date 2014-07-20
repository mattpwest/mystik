var console = require('console'),
    Q = require('q');

var mystik = {
    config: require('configure'),
    db: {},
    handlebars: require('handlebars'),
    passport: require('passport'),
    server: null,
    serverInstance: null,
    settings: null,
};

require('./src/server/db.js')(mystik)
 .then(require('./src/server/templates.js'))
 .then(require('./src/server/security.js'))
 .then(require('./src/server/routes.js'))
 .then(function(result) {
    mystik.serverInstance = mystik.server.listen(mystik.config.port, function() {
        console.log('Mystik CMS started - listening on port %d', mystik.serverInstance.address().port);
    });
    module.exports = mystik;
 }, function(err) {
    if (err !== null) {
        console.log('Failed to start Mystik CMS...');
        console.log(err.stack);
        process.exit(-1);
    }
 })
 .done();
