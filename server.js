var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
var flash = require('connect-flash');
var AWS = require('aws-sdk');
var fs = require('fs');
var debug = require('debug');
var adfs = require('./adfs');

var config = JSON.parse(fs.readFileSync('.config/adfs.json', { encoding: 'UTF8' }));

// adfs

var debugAdfs = debug('adfs');
var generateCredentials = function (username, password, done) {
    debugAdfs('Fetching assertion from ADFS host');
    adfs.fetchAssertion(config.host, username, password, function (err, assertion) {
        if (err) {
            done(err);
        } else {
            debugAdfs('Obtaining AWS credentials from assertion');
            adfs.obtainCredentials(config.roleArn, config.principalArn, assertion, function (err, credentials) {
                if (err) {
                    done(err);
                } else {
                    done(null, credentials);
                }
            });
        }
    });
};


// s3

var debugS3 = debug('s3');
var pipeS3Stream = function (bucket, key, req, res, done) {
    var s3 = new AWS.S3({ credentials: new AWS.Credentials(
        req.user.credentials.accessKeyId,
        req.user.credentials.secretAccessKey,
        req.user.credentials.sessionToken
    )});
    var request = s3.getObject({
        Bucket: bucket,
        Key: key
    });
    var stream = request.createReadStream();
    stream.pipe(res);

    request.on('success', function () {
        debugS3('%s piped from s3://%s/%s', req.user.username, bucket, key);
        done(null);
    });
    stream.on('error', function () {
        debugS3('%s failed to obtain S3 stream', req.user.username);
        done('Failed to pipe S3 stream');
    });
};


// passport

var debugPassport = debug('passport');

passport.use(new LocalStrategy(function(username, password, done) {
    generateCredentials(username, password, function (err, credentials) {
        if (err) {
            debugPassport('%s login failed: %s', username, err);
            return done(null, false, { message: err });
        } else {
            debugPassport('%s login succeed', username);
            done(null, { username: username, credentials: credentials });
        }
    });
}));

passport.serializeUser(function (user, done) {
    done(null, JSON.stringify(user));
});

passport.deserializeUser(function (json, done) {
    done(null, JSON.parse(json));
});



// express

var debugExpress = debug('express');

var app = express();

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
    secret: 'shhhh, very secret',
    cookie: { maxAge: 50 * 60 * 1000 } // 50 mins, slightly below the the adfs token expiry
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', function(req, res){
    res.render('login', { message: req.flash('error') });
});

app.post('/login',
    passport.authenticate('local', {
        successReturnToOrRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    })
);

app.get(/^\/s3\/(.+?)\/(.+)$/,
    ensureLoggedIn('/login'),
    function (req, res) {
        var bucket = req.params[0];
        var key = req.params[1];

        pipeS3Stream(bucket, key, req, res, function (err) {
            if (err) {
                res.redirect('/login');
            }
        });
    }
);

var port = 3000;
app.listen(port, function () {
    debugExpress('Server running on localhost:' + port);
});
