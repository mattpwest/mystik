#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
// Above magic copied from: http://unix.stackexchange.com/questions/65235/universal-node-js-shebang 

var program = require('commander'),
    fs = require('fs-extra'),
    path = require('path'),
    Buffer = require('buffer').Buffer,
    Handlebars = require('handlebars');

program
    .version('0.1.0-alpha.2')
    .option('-c, --create [folder]', 'Creates a new CMS instance in the specified folder.')
    .option('-i, --install', 'Installs an Upstart script to start your instance as a service.')
    .option('-p, --production', 'Run the site in production mode (without any arguments it defaults to theming mode).')
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
    return;
}

var gulpfile = require('./gulpfile.js');
if (program.production) {
    runInProductionMode();    
} else if (program.install) {
    installUpstartScript();
} else {
    runInThemingMode();
}

function dirContainsCMS(dir) {
    var cfgFile = path.join(dir, 'config.json');
    return fs.existsSync(cfgFile);
}

function onCopyError(err) {
    console.log('\t\tCopy failed: ' + err);
    process.exit(-1);
}

function runInThemingMode() {
    gulpfile.start('theming', function(err) {
        if (err) {
            console.log(err);
            process.exit(-1);
        }

        console.log('Starting in theming mode...');
    });
}

function runInProductionMode() {
    gulpfile.start('build-all', function(err) {
        if (err) {
            console.log(err);
            process.exit(-1);
        }

        var appModule = path.join(sourceDir, 'server.js');
        require(path.join(sourceDir, 'server.js'));
    });
}

function installUpstartScript() {
    var instanceName = path.basename(workingDir);
    var serviceName = 'mystik-' + instanceName;
    console.log('Installing service script named: ' + serviceName);

    fs.open('/etc/init/' + serviceName + '.conf', 'w', 0644, function(err, fd) {
        if (err !== null) {
            console.log('Error - installing service script failed: ' + err);
            process.exit(-1);
        }

        loadUpstartTemplate(function(err, template) {
            if (err !== null) {
                console.log('Error - installing service script failed: ' + err);
                process.exit(-1);
            }

            var buffer = new Buffer(template({instanceName: instanceName, instanceDir: workingDir}));
            
            fs.write(fd, buffer, 0, buffer.length, 0, function(err) {
                if (err !== null) {
                    console.log('Error - installing service script failed: ' + err);
                    process.exit(-1);
                }

                fs.close(fd, function(err) {
                    if (err !== null) {
                        console.log('Error - installing service script failed: ' + err);
                        process.exit(-1);
                    }

                    console.log('Service script installation successful!\n');

                    console.log('Your instance will now start on boot and you can manage it with:');
                    console.log('\tservice ' + serviceName + ' start');
                    console.log('\tservice ' + serviceName + ' status');
                    console.log('\tservice ' + serviceName + ' restart');
                    console.log('\tservice ' + serviceName + ' stop');
                });
            });
        });
    });
}

function loadUpstartTemplate(callback) {
    var templateFile = path.join(sourceDir, 'src', 'scripts', 'service.upstart')
    fs.readFile(templateFile, 'utf8', function(err, data) {
        if (err !== null) {
            callback('Could not load template "' + templateFile + '" due to: ' + err, null);
            return;
        }

        callback(null, Handlebars.compile(data));
    });
}