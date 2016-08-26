var express = require('express');
var morgan = require('morgan');
var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;
var AWS = require('aws-sdk');
var auth = require('./auth');

var app = express();
app.use(morgan('combined'));
passport.use(new BasicStrategy(auth.authenticate));

app.get(/^\/s3\/(.+?)\/(.+)$/,
    passport.authenticate('basic', { session: false }),
    function (req, res) {
        var bucket = req.params[0];
        var key = req.params[1];
        console.log('Piping from S3 Bucket: ' + bucket + ' / Key: ' + key + '\n');

        var s3 = new AWS.S3();
        var stream = s3.getObject({
            Bucket: bucket,
            Key: key
        }).createReadStream();
        stream.pipe(res);
    }
);

var port = 3000;
app.listen(port, function () {
    console.log('Server running on localhost:' + port);
});
