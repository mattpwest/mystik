var fs = require('fs'),
    path = require('path'),
    Q = require('q');

// Views in the templateDir are loaded automatically by the templating engine,
// but Handlebars partials must be registered manually
module.exports = function registerPartials(mystik) {
    return loadPartialsForTheme(mystik.handlebars, mystik.settings.theme)
        .then(function(loadedPartials) {
            console.log('\tLoaded partials: ');

            loadedPartials.forEach(function(partial) {
                console.log('\t\t', partial);
            });
            
            return mystik;
        });
};

function loadPartialsForTheme(handlebars, theme) {
    var partialsDir = path.join(process.cwd(), 'templates', 'partials');
    console.log('Loading partials from %s', partialsDir);

    return findFilesInPath(partialsDir)
        .then(function(files) {
            var partials = [];

            files.forEach(function(filename) {
                partials.push(loadPartial(handlebars, partialsDir, filename));
            });

            return Q.all(partials);
        });
}

function findFilesInPath(path) {
    var deferred = Q.defer();

    fs.readdir(path, function(err, files) {
        if (err !== null) {
            deferred.reject(new Error(err));
        } else {
            deferred.resolve(files);
        }
    });

    return deferred.promise;
}

function loadPartial(handlebars, dir, filename) {
    var deferred = Q.defer();
    var matches = /^([^.]+).html$/.exec(filename);
    if (!matches) {
        deferred.resolve('');
    } else {
        var name = matches[1];
        var template = fs.readFile(path.join(dir, filename), 'utf8', function(err, template) {
            if (err !== null) {
                deferred.reject(new Error(err));
            } else {
                handlebars.registerPartial(name, template);
                deferred.resolve(name);
            }
        });
    }

    return deferred.promise;
}