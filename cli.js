#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
// Above magic copied from: http://unix.stackexchange.com/questions/65235/universal-node-js-shebang 

var program = require('commander'),
    gulpfile = require('./gulpfile.js'),
    fs = require('fs-extra'),
    path = require('path');

program
    .version('0.1.0-alpha.2')
    .option('-c, --create [folder]', 'Creates a new CMS instance in the specified folder.')
    .option('-d, --development', 'Development mode.')
    .option('-t, --theming', 'Theming mode.')
    .parse(process.argv);

var workingDir = process.cwd(),
    sourceDir = path.dirname(process.mainModule.filename);


if (program.create) {
    var targetDir = program.create;
    if (dirContainsCMS(targetDir)) {
        console.log('Looks like \'%s\' already contains a CMS instance... rather run this on a clean directory to be safe.', program.create);
        program.help();
    }

    console.log('Creating new CMS instance ...');

    toPath = path.join(targetDir, 'static', 'images');
    console.log('\tCreating static content folder at %s ...', toPath);
    fs.mkdirs(toPath);

    toPath = path.join(targetDir, 'templates');
    console.log('\tCopying templates to %s ...', toPath);
    fs.copy(path.join(sourceDir, 'src', 'instance', 'templates'), toPath);

    toPath = path.join(targetDir, 'less');
    console.log('\tCopying less to %s ...', toPath);
    fs.copy(path.join(sourceDir, 'src', 'instance', 'less'), toPath);

    toPath = path.join(targetDir, 'js');
    console.log('\tCopying js to %s ...', toPath);
    fs.copy(path.join(sourceDir, 'src', 'instance', 'js'), toPath);

    toPath = path.join(targetDir, 'config.json');
    console.log('\tCopying default config to %s ...', toPath);
    fs.copy(path.join(sourceDir, 'config.json'), toPath);

    toPath = path.join(targetDir, 'bower.json');
    console.log('\tCopying Bower config to %s ...', toPath);
    fs.copy(path.join(sourceDir, 'bower.json'), toPath);

    return;
}

if (!dirContainsCMS(workingDir)) {
    console.log('The current folder does not seem to contain a valid Mystik CMS instance...');
    console.log('');
    console.log('If the current folder is empty it should be safe to run this command with -c . to create a new instance in this folder.');
    program.help();
}

if (program.development) {
    gulpfile.start('develop', function(err) {
        if (err) {
            console.log(err);
            process.exit(-1);
        }
    });
} else if (program.theming) {
    gulpfile.start('theming', function(err) {
        if (err) {
            console.log(err);
            process.exit(-1);
        }
    });
} else {
    var appModule = path.join(sourceDir, 'server.js');
    console.log("APP_MODULE: %s", appModule);
    require(path.join(sourceDir, 'server.js'));
}

function dirContainsCMS(dir) {
    var cfgFile = path.join(dir, 'config.json');
    return fs.existsSync(cfgFile);
}

function onCopyError(err) {
    console.log('\t\tCopy failed: ' + err);
    process.exit(-1);
}