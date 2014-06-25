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

// TODO: Will only work if all of these return promises
require('./src/server/db.js')(mystik)
 .then(require('./src/server/templates.js'))
 .then(require('./src/server/security.js'))
 .then(function(result) {
    console.log('Mystik server initialisation completed!');
 }, function(err) {
    console.error(err);
}).done();
 /*
 
 .then(require('./src/server/server.js')(mystik))
 .then(require('./src/server/routes.js')(mystik))
 .then(function startMystikServer() {
    mystik.serverInstance = mystik.server.listen(mystik.config.port, function() {
        console.log('Mystik CMS started - listening on port %d', instance.address().port);
    });
 })
 .catch(function(err) {
    if (err !== null) {
        console.log('Failed to start Mystik CMS due to: ', err);
        system.exit(-1);
    }
 });
*/
module.exports = mystik;