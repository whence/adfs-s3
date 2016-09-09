import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import session from 'express-session';
import passport from 'passport';
import { Strategy } from 'passport-local';
import { ensureLoggedIn } from 'connect-ensure-login';
import flash from 'connect-flash';
import AWS from 'aws-sdk';
import debug from 'debug';
import async from 'async';
import path from 'path';
import { fetchAssertion, obtainCredentials } from './adfs';
import config from './config/adfs';

// adfs

const debugAdfs = debug('adfs');
function generateCredentials(username, password, done) {
  async.waterfall([
    (cb) => {
      debugAdfs('%s fetching assertion from ADFS host', username);
      fetchAssertion(config.host, username, password, cb);
    },
    (assertion, cb) => {
      debugAdfs('%s obtaining AWS credentials from assertion', username);
      obtainCredentials(config.roleArn, config.principalArn, assertion, cb);
    }],
  done);
}

// s3

const debugS3 = debug('s3');
function pipeS3Stream(bucket, key, req, res, done) {
  const s3 = new AWS.S3({ credentials: new AWS.Credentials(
    req.user.credentials.accessKeyId,
    req.user.credentials.secretAccessKey,
    req.user.credentials.sessionToken
  ) });
  const request = s3.getObject({
    Bucket: bucket,
    Key: key,
  });
  const stream = request.createReadStream();
  stream.pipe(res);

  request.on('success', () => {
    debugS3('%s piped from s3://%s/%s', req.user.username, bucket, key);
    done(null);
  });
  stream.on('error', () => {
    debugS3('%s failed to obtain S3 stream', req.user.username);
    done('Failed to pipe S3 stream');
  });
}


// passport

const debugPassport = debug('passport');

passport.use(new Strategy((username, password, done) => {
  generateCredentials(username, password, (err, credentials) => {
    if (err) {
      debugPassport('%s login failed: %s', username, err);
      done(null, false, { message: err });
    } else {
      debugPassport('%s login succeed', username);
      done(null, { username, credentials });
    }
  });
}));

passport.serializeUser((user, done) => {
  done(null, JSON.stringify(user));
});

passport.deserializeUser((json, done) => {
  done(null, JSON.parse(json));
});


// express

const debugExpress = debug('express');

const app = express();

app.set('view engine', 'ejs');
app.set('views', `${path.join(__dirname, '..', 'views')}`);

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret',
  cookie: { maxAge: 50 * 60 * 1000 }, // 50 mins, slightly below the the adfs token expiry
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', (req, res) => {
  res.render('login', { message: req.flash('error') });
});

app.post('/login',
  passport.authenticate('local', {
    successReturnToOrRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true,
  })
);

app.get(/^\/s3\/(.+?)\/(.+)$/,
    ensureLoggedIn('/login'),
    (req, res) => {
      const bucket = req.params[0];
      const key = req.params[1];

      pipeS3Stream(bucket, key, req, res, (err) => {
        if (err) {
          res.redirect('/login');
        }
      });
    }
);

const port = 3000;
app.listen(port, () => {
  debugExpress(`Server running on localhost:${port}'`);
});
