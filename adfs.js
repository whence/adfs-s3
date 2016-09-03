const request = require('request');
const cheerio = require('cheerio');
const AWS = require('aws-sdk');

function isExpired(credentials, done) {
  const iam = new AWS.IAM({ credentials });
  iam.getAccountSummary((err) => {
    if (err) {
      done(null, true);
    } else {
      done(null, false);
    }
  });
}

function fetchAssertion(host, username, password, done) {
  const url = `https://${host}/adfs/ls/IdpInitiatedSignOn.aspx?loginToRp=urn:amazon:webservices`;
  const form = {
    UserName: username,
    Password: password,
    AuthMethod: 'urn:amazon:webservices'
  };
  const jar = request.jar();
  const options = {
    url,
    form,
    jar,
    followAllRedirects: true
  };
  request.post(options, (err, httpResponse, body) => {
    if (err) {
      done(err);
    } else if (httpResponse.statusCode !== 200) {
      done(`Request returns ${httpResponse.statusCode}`);
    } else {
      const $ = cheerio.load(body);
      const error = $('form#loginForm #errorText').text();
      if (error) {
        done(error);
      } else {
        const assertion = $('form[name=hiddenform] input[name=SAMLResponse]').prop('value');
        if (assertion) {
          done(null, assertion);
        } else {
          done('Empty SAMLResponse');
        }
      }
    }
  });
}

function obtainCredentials(roleArn, principalArn, assertion, done) {
  const params = {
    PrincipalArn: principalArn,
    RoleArn: roleArn,
    SAMLAssertion: assertion,
    DurationSeconds: 3600
  };
  const sts = new AWS.STS();
  sts.assumeRoleWithSAML(params, (err, data) => {
    if (err) {
      done(err);
    } else {
      const credentials = {
        accessKeyId: data.Credentials.AccessKeyId,
        secretAccessKey: data.Credentials.SecretAccessKey,
        sessionToken: data.Credentials.SessionToken
      };
      done(null, credentials);
    }
  });
}

exports.isExpired = isExpired;
exports.fetchAssertion = fetchAssertion;
exports.obtainCredentials = obtainCredentials;
