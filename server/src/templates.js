var fs = require('fs'),
    path = require('path');

// Views in the templateDir are loaded automatically by the templating engine,
// but Handlebars partials must be registered manually
module.exports = function registerPartials(config, handlebars) {
    var partialsDir = path.join(process.cwd(), 'templates', 'partials');

    console.log('Loading Handlebars partials from %s', partialsDir);
    var filenames = fs.readdirSync(partialsDir);

    filenames.forEach(function(filename) {
        var matches = /^([^.]+).html$/.exec(filename);
        if (!matches) {
            return;
        }

        var name = matches[1];
        var template = fs.readFileSync(path.join(partialsDir, filename), 'utf8');
        handlebars.registerPartial(name, template);
    });
};