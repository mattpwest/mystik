var LocalStrategy = require('passport-local').Strategy;

module.exports = function(passport, db) {
    passport.use('local-login',
            new LocalStrategy({
                    usernameField: 'email',
                    passwordField: 'password',
                    passReqToCallback: true
                }, function(req, username, password, done) {
        db.users.findOne({email: username}, function(err, user) {
            if (err) {
                console.log('Failed to authenticate due to DB error: ', err);
                return done(err, req.flash('loginMessage', 'Unable to login due to database error.'));
            }

            if (!user) {
                console.log('Failed to authenticate: no such user ', username);
                return done(null, false, req.flash('loginMessage', 'User not found.'));
            }

            if (user.password !== password) {
                console.log('Failed to authenticate ', username, ': incorrect password.');
                return done(null, false, req.flash('loginMessage', 'Incorrect password.'));
            }

            return done(null, user);
        });
    }));

    passport.serializeUser(function(user, done) {
        done(null, user._id);
    });

    passport.deserializeUser(function(id, done) {
        db.users.findOne({_id: id}, function(err, user) {
            if (err) {
                done(err);
            }

            if (!user) {
                done(null, false, 'No user with id: ' + id);
            }

            done(null, user);
        });
    });
};