var gulp = require('gulp'),
    less = require('gulp-less'),
    path = require('path'),
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
    minifyCSS = require('gulp-minify-css'),
    browserSync = require('browser-sync');

var wrkDir = process.cwd(),
    srcDir = path.dirname(process.mainModule.filename);

var libraries = {
    css: [],
    js: [],
};

var liveReloadServer = null;

gulp.task('bower', function() {
    return bower()
            .pipe(gulp.dest(path.join(wrkDir, 'bower_components')));
});

gulp.task('copyBowerFiles', ['bower'], function() {
    var cssFilter = filter('**/*.css'),
        jsFilter = filter('**/*.js'),
        fontsFilter = filter('**/fonts/*');

    libraries = {
        css: [],
        js: [],
    };

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

gulp.task('less', ['copyBowerFiles'], function() {
    return gulp.src(path.join(wrkDir, 'less', 'main.less'))
        .pipe(less())
        .pipe(gulp.dest(path.join(wrkDir, 'tmp')));
});

gulp.task('css', ['less'], function() {
    libraries.css.push(path.join(wrkDir, 'tmp', 'main.css'));

    return gulp.src(libraries.css)
        .pipe(concat('main.css'))
        .pipe(gulp.dest(path.join(wrkDir, 'static', 'css')))
        .pipe(minifyCSS())
        .pipe(rename('main.min.css'))
        .pipe(gulp.dest(path.join(wrkDir, 'static', 'css')))
        .pipe(browserSync.reload({stream: true}));
});

gulp.task('jsCheck', ['copyBowerFiles'], function() {
    return gulp.src(path.join(wrkDir, 'js', 'main.js'))
        .pipe(jshint())
        .pipe(jshint.reporter(stylish));
});

gulp.task('js', ['jsCheck'], function() {
    libraries.js.push(path.join(wrkDir, 'js', 'main.js'));

    return gulp.src(libraries.js)
      .pipe(concat('main.js'))
      .pipe(gulp.dest(path.join(wrkDir, 'static', 'js')))
      .pipe(uglify())
      .pipe(rename('main.min.js'))
      .pipe(gulp.dest(path.join(wrkDir, 'static', 'js')))
      .pipe(browserSync.reload({stream: true}));
});

gulp.task('server-scripts', function() {
    gulp.src(['*.js', 'src/**/*.js'])
        .pipe(tap(function(file, t) {
            console.log('Linting %s', file.path);
        }))
        .pipe(jshint())
        .pipe(jshint.reporter(stylish));
});

gulp.task('theming', ['css', 'js'], function () {
    var mainScript = path.join(srcDir, 'server.js');
    //liveReloadServer = livereload();

    var server = require(path.join(srcDir, 'server.js'));
    browserSync.init(['templates/**/*.html'], {
        proxy: 'localhost:9080'
    });

    libraries.js.push(path.join(wrkDir, 'js', 'main.js'));
    gulp.watch(libraries.js, ['js']);

    gulp.watch(path.join(wrkDir, 'less', 'main.less'), ['css']);
});

// Default task executed when running Gulp from the command line
gulp.task('default', ['theming']);

// Export gulp for calling programmatically from the CLI
module.exports = gulp;