var express = require('express');
var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;
var AWS = require('aws-sdk');
var cache = require('memory-cache');
var hasher = require('password-hash-and-salt');
var fs = require('fs');
var adfs = require('./adfs');

var config = JSON.parse(fs.readFileSync('.config/adfs.json', { encoding: 'UTF8' }));

var getCredentials = function (username, password, done) {
    var user = cache.get(username);
    if (user) {
        hasher(password).verifyAgainst(user.password_hash, function (err, verified) {
            if (err) {
                done(null);
            } else if (!verified) {
                done(null);
            } else {
                console.log('Retrieved ' + username + ' credentials from cache.');
                done(user.credentials);
            }
        });
    } else {
        done(null);
    }
};

var storeCredentials = function (username, password, credentials, done) {
    hasher(password).hash(function (err, hash) {
        if (err) {
            done(err);
        } else {
            var user = {
                username: username,
                password_hash: hash,
                credentials: credentials
            };
            cache.put(username, user);
            console.log(username + ' credentials cached.');
            done(null);
        }
    });
};

var generateCredentials = function (username, password, done) {
    adfs.fetchAssertion(config.host, username, password, function (err, assertion) {
        if (err) {
            done(err);
        } else {
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
    var s3 = new AWS.S3({ credentials: credentials });
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
    var username = req.user.username;
    var password = req.user.password;

    var refreshCredentials = function () {
        generateCredentials(username, password, function (err, credentials) {
            if (err) {
                res.statusCode = 401;
                res.send('401 Unauthorized');
            } else {
                storeCredentials(username, password, credentials, function (err) {
                    if (err) {
                        res.statusCode = 401;
                        res.send('Internal error');
                    } else {
                        pipeS3Stream(bucket, key, credentials, res, function (err) {
                            if (err) {
                                res.statusCode = 401;
                                res.send('401 Unauthorized');
                            }
                        });
                    }
                });
            }
        });
    };

    getCredentials(username, password, function (credentials) {
        if (credentials) {
            pipeS3Stream(bucket, key, credentials, res, function (err) {
                if (err) {
                    console.log('First attempt to obtain S3 stream failed. Will re-authenticate with ADFS and try again.');
                    refreshCredentials();
                }
            });
        } else {
            refreshCredentials();
        }
    });
};


// configurate express

var app = express();
passport.use(new BasicStrategy(function (username, password, done) {
    return done(null, { username: username, password: password });
}));

app.get(/^\/s3\/(.+?)\/(.+)$/,
    passport.authenticate('basic', { session: false }),
    handleS3Request);

var port = 3000;
app.listen(port, function () {
    console.log('Server running on localhost:' + port);
});
