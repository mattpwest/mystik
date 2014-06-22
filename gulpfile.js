var gulp = require('gulp'),
    nodemon = require('gulp-nodemon'),
    less = require('gulp-less'),
    livereload = require('gulp-livereload'),
    path = require('path'),
    fs = require('fs'),
    concat = require('gulp-concat'),
    rename = require('gulp-rename'),
    uglify = require('gulp-uglify'),
    clean = require('gulp-clean');

var wrkDir = process.cwd(),
    srcDir = path.dirname(process.mainModule.filename);

var paths = {
    input: {
        fonts: path.join(wrkDir, 'libs', 'bootstrap-3.1.1', 'fonts', '*'),
        js: [
            path.join(wrkDir, 'libs', 'bootstrap-3.1.1', 'js', '*.js')
        ],
        less: [
            path.join(wrkDir, 'stylesheets', '*.less'),
            path.join(wrkDir, 'libs', 'bootstrap-3.1.1', 'less', 'bootstrap.less')
        ],
    },
    output: {
        fonts: path.join(wrkDir, 'static', 'fonts'),
        js: path.join(wrkDir, 'static', 'js'),
        less: path.join(wrkDir, 'static', 'css')
    },
    src: srcDir
}

gulp.task('clean', function() {
    gulp.src([paths.output.fonts, paths.output.js, paths.output.less], {read: false})
        .pipe(clean());
});

gulp.task('less', function() {
    gulp.src(paths.input.less)
        .pipe(less())
        .pipe(gulp.dest(paths.output.less));
});

gulp.task('scripts', function() {
    gulp.src(paths.input.js)
      .pipe(concat('bootstrap.all.js'))
      .pipe(gulp.dest(paths.output.js))
      .pipe(uglify())
      .pipe(rename('bootstrap.min.js'))
      .pipe(gulp.dest(paths.output.js));
});

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

gulp.task('develop', ['copy', 'scripts', 'less', 'watch'], function () {
    var mainScript = path.join(paths.src, 'server.js');
    nodemon({ script: mainScript, ext: 'html js', ignore: ['ignored.js'] })
        .on('change', [])
        .on('restart', []); // TODO: Figure out how to trigger a livereload here...
});

// Default task executed when running Gulp from the command line
gulp.task('default', ['less', 'watch']);

// Export gulp for calling programmatically from the CLI
module.exports = gulp;