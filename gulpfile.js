var gulp = require('gulp'),
    nodemon = require('gulp-nodemon'),
    less = require('gulp-less'),
    livereload = require('gulp-livereload'),
    path = require('path'),
    fs = require('fs'),
    concat = require('gulp-concat'),
    rename = require('gulp-rename'),
    uglify = require('gulp-uglify'),
    clean = require('gulp-clean'),
    jshint = require('gulp-jshint'),
    stylish = require('jshint-stylish'),
    bower = require('gulp-bower'),
    bowerFiles = require('gulp-bower-files'),
    filter = require('gulp-filter'),
    flatten = require('gulp-flatten'),
    tap = require('gulp-tap'),
    minifyCSS = require('gulp-minify-css');

var wrkDir = process.cwd(),
    srcDir = path.dirname(process.mainModule.filename);

var libraries = {
    css: [],
    js: [],
};

gulp.task('bower', function() {
    return bower()
            .pipe(gulp.dest(path.join(wrkDir, 'bower_components')));
});

gulp.task('copyBowerFiles', ['bower'], function() {
    var cssFilter = filter('**/*.css'),
        jsFilter = filter('**/*.js'),
        fontsFilter = filter('**/fonts/*');

    return bowerFiles()
            .pipe(cssFilter)
            .pipe(tap(function(file, t) {
                libraries.css.push(file.path);
            }))
            .pipe(cssFilter.restore())

            .pipe(jsFilter)
            .pipe(tap(function(file, t) {
                libraries.js.push(file.path);
            }))
            .pipe(jsFilter.restore())

            .pipe(fontsFilter)
            .pipe(flatten())
            .pipe(gulp.dest(path.join(wrkDir, 'static', 'fonts')));
});

gulp.task('less', function() {
    return gulp.src(path.join(wrkDir, 'less', 'main.less'))
        .pipe(less())
        .pipe(gulp.dest(path.join(wrkDir, 'tmp')));
});

gulp.task('css', ['copyBowerFiles', 'less'], function() {
    libraries.css.push(path.join(wrkDir, 'tmp', 'main.css'));

    return gulp.src(libraries.css)
        .pipe(concat('main.css'))
        .pipe(gulp.dest(path.join(wrkDir, 'static', 'css')))
        .pipe(minifyCSS())
        .pipe(rename('main.min.css'))
        .pipe(gulp.dest(path.join(wrkDir, 'static', 'css')));
});

gulp.task('jsCheck', function() {
    return gulp.src(path.join(wrkDir, 'js', 'main.js'))
        .pipe(jshint())
        .pipe(jshint.reporter(stylish));
})

gulp.task('js', ['copyBowerFiles', 'jsCheck'], function() {
    libraries.js.push(path.join(wrkDir, 'js', 'main.js'));

    gulp.src(libraries.js)
      .pipe(concat('main.js'))
      .pipe(gulp.dest(path.join(wrkDir, 'static', 'js')))
      .pipe(uglify())
      .pipe(rename('main.min.js'))
      .pipe(gulp.dest(path.join(wrkDir, 'static', 'js')));
});

gulp.task('server-scripts', function() {
    gulp.src([path.join(srcDir, 'cli.js'),
                path.join(srcDir, 'gulpfile.js'),
                path.join(srcDir, 'server.js'),
                path.join(srcDir, 'src', '**', '*.js')])
      .pipe(jshint())
      .pipe(jshint.reporter(stylish));
});

/*
gulp.task('copy', function() {
    gulp.src(paths.input.fonts)
        .pipe(gulp.dest(paths.output.fonts));
});

gulp.task('watch', function() {
    var server = livereload();

    gulp.watch(path.join(paths.output.less, '*.css'))
        .on('change', function(file) {
            server.changed(file.path);
        });

    gulp.watch(paths.input.less, ['less']);
});
*/

//gulp.task('develop', ['copy', 'server-scripts', 'scripts', 'less', 'watch'], function () {
gulp.task('develop', ['server-scripts'], function () {
    var mainScript = path.join(srcDir, 'server.js');

    nodemon({ script: mainScript, ext: 'html js', ignore: ['ignored.js'] })
        .on('change', [])
        .on('restart', []); // TODO: Figure out how to trigger a livereload here...
});

//gulp.task('theming', ['copy', 'scripts', 'less', 'watch'], function () {
gulp.task('theming', ['css', 'js'], function () {
    var mainScript = path.join(srcDir, 'server.js');

    nodemon({ script: mainScript, ext: 'html js', ignore: ['ignored.js'] })
        .on('change', [])
        .on('restart', []); // TODO: Figure out how to trigger a livereload here...
});

// Default task executed when running Gulp from the command line
gulp.task('default', ['less', 'watch']);

// Export gulp for calling programmatically from the CLI
module.exports = gulp;