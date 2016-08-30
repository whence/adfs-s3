var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var AWS = require('aws-sdk');
var fs = require('fs');
var adfs = require('./adfs');

var config = JSON.parse(fs.readFileSync('.config/adfs.json', { encoding: 'UTF8' }));

var generateCredentials = function (username, password, done) {
    console.log('Fetching assertion from ADFS host');
    adfs.fetchAssertion(config.host, username, password, function (err, assertion) {
        if (err) {
            done(err);
        } else {
            console.log('Obtaining AWS credentials from assertion');
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

var pipeS3Stream = function (bucket, key, credentials, res, done) {
    var s3 = new AWS.S3({ credentials: new AWS.Credentials(
        credentials.accessKeyId,
        credentials.secretAccessKey,
        credentials.sessionToken
    )});
    var request = s3.getObject({
        Bucket: bucket,
        Key: key
    });
    var stream = request.createReadStream();
    stream.pipe(res);

    request.on('success', function () {
        console.log('Piped from S3 Bucket: ' + bucket + ' / Key: ' + key);
        done(null);
    });
    stream.on('error', function () {
        console.log('Failed to obtain S3 stream.');
        done('Failed to pipe S3 stream');
    });
};

var handleS3Request = function (req, res) {
    var bucket = req.params[0];
    var key = req.params[1];

    if (req.session.credentials) {
        pipeS3Stream(bucket, key, req.session.credentials, res, function (err) {
            if (err) {
                res.redirect('/login');
            }
        });
    } else {
        res.redirect('/login');
    }
};

var handleLogin = function (req, res) {
    var username = req.body.username;
    var password = req.body.password;

    generateCredentials(username, password, function (err, credentials) {
        if (err) {
            req.session.error = 'Authentication failed. ' + err;
            res.redirect('/login');
        } else {
            req.session.regenerate(function (){
                req.session.credentials = credentials;
                res.redirect('back');
            });
        }
    });
};

// configurate express

var app = express();

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
    secret: 'shhhh, very secret',
    cookie: { maxAge: 50 * 60 * 1000 } // 50 mins, slightly below the the adfs token expiry
}));

app.use(function(req, res, next){
    var err = req.session.error;
    var msg = req.session.success;
    delete req.session.error;
    delete req.session.success;
    res.locals.message = '';
    if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
    if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
    next();
});

app.get('/logout', function(req, res){
    req.session.destroy(function(){
        res.redirect('/');
    });
});

app.get('/login', function(req, res){
    res.render('login');
});

app.post('/login', handleLogin);

app.get(/^\/s3\/(.+?)\/(.+)$/,
    handleS3Request
);

var port = 3000;
app.listen(port, function () {
    console.log('Server running on localhost:' + port);
});
